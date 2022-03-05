# circuit-breaker-ts
      
    
Given a thunk `() => Promise<A>`, allow a configurable number of errors to occur before any subsequent calls to the thunk are short-circuited for a set amount of time.

The error threshold, error message and back off time are configurable.

Useful for protecting calls to external services that may experience an outage.

A convenience function that returns a singleton is available so that an instance can be built at app startup and injected into services.
    
Inspired by a great blog post on [circuit breakers in the functional world ](https://levelup.gitconnected.com/circuit-breaker-in-a-functional-world-9c555c8e9527?gi=bf0edfcf31bd)
