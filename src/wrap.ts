/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-18 10:44:51
 * @LastEditTime: 2021-11-18 11:02:12
 */
const isWrappedSymbol = Symbol('cls-tracer-is-wrapped')
const wrappedSymbol = Symbol('cls-tracer-wrapped-function')
import { AsyncResource } from "async_hooks";


const addMethods = [
  'on',
  'addListener',
  'prependListener'
]

const removeMethods = [
  'off',
  'removeListener'
]

/**
 * Wraps EventEmitter listener registration methods of the
 * given emitter, so that all listeners are run in scope of
 * the provided async resource.
 *
 * @param {*} emitter
 * @param {AsyncResource} asyncResource
 */
export function wrapEmitter(emitter: any, asyncResource: AsyncResource) {
  for (const method of addMethods) {
    wrapEmitterMethod(emitter, method, (original: Function) => function (name: string, handler: any) {
      handler[wrappedSymbol] = asyncResource.runInAsyncScope.bind(asyncResource, handler, emitter)
      return original.call(this, name, handler[wrappedSymbol]);
    })
  }

  for (const method of removeMethods) {
    wrapEmitterMethod(emitter, method, (original: Function) => function (name: string, handler: any) {
      return original.call(this, name, handler[wrappedSymbol] || handler);
    })
  }
}

/**
 *
 *
 * @param {*} emitter
 * @param {string} method
 * @param {Function} wrapper
 * @returns {*}  
 */
export function wrapEmitterMethod(emitter: any, method: string, wrapper: Function) {
  if (emitter[method][isWrappedSymbol]) {
    return;
  }

  const original = emitter[method];
  const wrapped = wrapper(original, method);
  wrapped[isWrappedSymbol] = true;
  emitter[method] = wrapped;

  return wrapped;
}
