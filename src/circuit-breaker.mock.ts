import { CircuitBreaker } from './index'
import { right } from './Either'

export const mockCircuitBreaker: CircuitBreaker = (t) => t().then((r) => right(r))
