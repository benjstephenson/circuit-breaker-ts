import { CircuitBreakerConfig, circuitBreakerSingleton } from './index'
import { assertThat } from 'mismatched'
import { Thespian, TMocked } from 'thespian'

describe('Circuit Breaker', () => {
  let thespian: Thespian
  let mockThunk: TMocked<() => Promise<number>>
  let dateTime: Date
  let mockDateProvider: TMocked<() => Date>

  beforeEach(() => {
    thespian = new Thespian()
    mockThunk = thespian.mock('thunk')
    dateTime = new Date(Date.now())
    mockDateProvider = thespian.mock('datetime')
  })

  it('continues to execute when the breaker is closed', async () => {
    const config: CircuitBreakerConfig = {
      description: 'test',
      errorThreshold: 1,
      resetTimeout: 1000,
    }

    const dateTime = new Date(Date.now())

    mockThunk
      .setup((t) => t())
      .returns(() => Promise.resolve(1))
      .times(2)

    const breaker = circuitBreakerSingleton(config, () => dateTime)
    await breaker(mockThunk.object)
    const result = await breaker(mockThunk.object)
    if (result.tag === 'Left') throw new Error('Unexpected left')

    assertThat(result.value).is(1)
  })

  it('continues to execute while error count has not exceeded threshold', async () => {
    const config: CircuitBreakerConfig = {
      description: 'test',
      errorThreshold: 2,
      resetTimeout: 1000,
    }

    mockThunk
      .setup((t) => t())
      .returns(() => Promise.reject(new Error('oops')))
      .times(2)
    const breaker = circuitBreakerSingleton(config, () => dateTime)
    await breaker(mockThunk.object)
    const result = await breaker(mockThunk.object)

    if (result.tag === 'Left') return assertThat(result.value).is(`${config.description}: Error in call: oops`)

    throw new Error(`Unexpected right value`)
  })

  it('stops executing when error count exceeds threshold', async () => {
    const config: CircuitBreakerConfig = {
      description: 'test',
      errorThreshold: 0,
      resetTimeout: 1000,
    }

    mockThunk.setup((t) => t()).returns(() => Promise.reject(new Error('oops')))
    const breaker = circuitBreakerSingleton(config, () => dateTime)
    await breaker(mockThunk.object)
    const result = await breaker(mockThunk.object)

    if (result.tag === 'Left')
      return assertThat(result.value).is(`${config.description}: circuit breaker is waiting to reset`)

    throw new Error(`Unexpected right value`)
  })

  it('recovers when the reset timeout has elapsed', async () => {
    const config: CircuitBreakerConfig = {
      description: 'test',
      errorThreshold: 1,
      resetTimeout: 1000,
    }

    const breaker = circuitBreakerSingleton(config, mockDateProvider.object)

    mockThunk.setup((t) => t()).returns(() => Promise.reject(new Error('oops')))
    mockDateProvider.setup((f) => f()).returns(() => dateTime)
    await breaker(mockThunk.object)

    mockThunk.setup((t) => t()).returns(() => Promise.resolve(1))
    mockDateProvider.setup((f) => f()).returns(() => new Date(dateTime.setMinutes(dateTime.getMinutes() + 1)))
    const result = await breaker(mockThunk.object)

    if (result.tag === 'Left') throw new Error(`Unexpected left value`)

    assertThat(result.value).is(1)
  })
})
