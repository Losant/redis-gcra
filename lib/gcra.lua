local rate_limit_key = KEYS[1]
local now            = ARGV[1]
local burst          = ARGV[2]
local rate           = ARGV[3]
local period         = ARGV[4]
local cost           = ARGV[5]

local emission_interval = period / rate
local increment         = emission_interval * cost
local burst_offset      = emission_interval * burst

local tat = redis.call("GET", rate_limit_key)

if not tat then
  tat = now
else
  tat = tonumber(tat)
end
tat = math.max(tat, now)

local new_tat = tat + increment
local allow_at = new_tat - burst_offset
local diff = now - allow_at

local limited
local retry_in
local reset_in

local remaining = math.floor(diff / emission_interval) -- poor man's round

if remaining < 0 then
  limited = 1
  -- calculate how many tokens there actually are, since
  -- remaining is how many there would have been if we had been able to limit
  -- and we did not limit
  remaining = math.floor((now - (tat - burst_offset)) / emission_interval)
  reset_in = math.ceil(tat - now)
  retry_in = math.ceil(diff * -1)
elseif remaining == 0 and increment <= 0 then
  -- request with cost of 0
  -- cost of 0 with remaining 0 is still limited
  limited = 1
  remaining = 0
  reset_in = math.ceil(tat - now)
  retry_in = 0 -- retry in is meaningless when cost is 0
else
  limited = 0
  reset_in = math.ceil(new_tat - now)
  retry_in = 0
  if increment > 0 then
    redis.call("SET", rate_limit_key, new_tat, "PX", reset_in)
  end
end

return {limited, remaining, retry_in, reset_in, tostring(diff), tostring(emission_interval)}