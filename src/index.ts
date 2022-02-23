
class Left<E> {
  readonly _tag = 'left'
  constructor(readonly error: E) { }
}

export class Right<A> {
  readonly _tag = 'right'
  constructor(readonly value: A) { }
}

type Either<E, A> = Left<E> | Right<A>

class UnreachableCaseError extends Error {
  constructor(e: never) {
    super(`Unreachable case branch: ${JSON.stringify(e)}`)
  }
}

export type CircuitBreaker = <A>(thunk: () => Promise<A>) => Promise<Either<string, A>>
type CircuitResult<A> = Promise<[Either<string, A>, BreakerState]>
type BreakerState = BreakerClosed | BreakerOpen

class BreakerClosed {
  public readonly _type = 'Closed'
  constructor(public readonly errorCount: number) { }
}

class BreakerOpen {
  public readonly _type = 'Open'
  constructor(readonly timeTripped: number) { }
}

type Milliseconds = number

export interface CircuitBreakerConfig {
  resetTimeout: Milliseconds
  errorThreshold: number
  description: string
}

const incrementErrorCount = (config: CircuitBreakerConfig, dateTimeProvider: () => Date) => (
  state: BreakerState
) => {
  switch (state._type) {
    case 'Closed':
      if (state.errorCount >= config.errorThreshold) return new BreakerOpen(dateTimeProvider().valueOf())

      return new BreakerClosed(state.errorCount + 1)

    case 'Open':
      return state

    default:
      throw new UnreachableCaseError(state)
  }
}

const closedHandler = (config: CircuitBreakerConfig, dateTimeProvider: () => Date) => async <A>(
  state: BreakerState,
  thunk: () => Promise<A>
): CircuitResult<A> => {
  try {
    const result = await thunk()
    return [new Right(result), new BreakerClosed(0)]
  } catch (e) {
    const error = new Left(`${config.description}: Error in call: ${e instanceof Error ? e.message : 'unknown'}`)
    const newState = incrementErrorCount(config, dateTimeProvider)(state)
    return Promise.resolve([error, newState])
  }
}

const openHandler = (config: CircuitBreakerConfig, dateTimeProvider: () => Date) => <A>(
  state: BreakerOpen,
  thunk: () => Promise<A>
): CircuitResult<A> => {
  const [canaryCall, breakerState] =
    state.timeTripped + config.resetTimeout < dateTimeProvider().valueOf()
      ? [true, new BreakerOpen(dateTimeProvider().valueOf())]
      : [false, state]

  return canaryCall
    ? closedHandler(config, dateTimeProvider)(breakerState, thunk)
    : Promise.resolve([
      new Left(
        `${config.description}: circuit breaker is waiting to reset`
      ),
      breakerState,
    ])
}

const circuitBreaker = (config: CircuitBreakerConfig, dateTimeProvider: () => Date) => <A>(
  state: BreakerState,
  thunk: () => Promise<A>
): CircuitResult<A> => {
  switch (state._type) {
    case 'Closed':
      return closedHandler(config, dateTimeProvider)(state, thunk)
    case 'Open':
      return openHandler(config, dateTimeProvider)(state, thunk)
    default:
      throw new UnreachableCaseError(state)
  }
}

export const circuitBreakerSingleton = (
  config: CircuitBreakerConfig,
  dateTimeProvider: () => Date
): CircuitBreaker => {
  let state: BreakerState = new BreakerClosed(0)
  const service = circuitBreaker(config, dateTimeProvider)

  return async <A>(thunk: () => Promise<A>) => {
    const [result, newState] = await service(state, thunk)
    state = newState
    return result
  }
}
