import { CircuitBreaker, Right } from './index'

export const mockCircuitBreaker: CircuitBreaker = t => t().then(r => new Right(r))
