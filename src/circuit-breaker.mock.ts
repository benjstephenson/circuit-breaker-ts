import { CircuitBreaker } from './index'
import { Right } from '@benjstephenson/kittens-ts/Either'

export const mockCircuitBreaker: CircuitBreaker = t => t().then(r => new Right(r))
