module.exports = {
  get (obj, propChain) {
    if ((obj !== null && typeof obj === 'object') && typeof propChain === 'string') {
      return propChain.split('.').reduce((r, item) => typeof r === 'undefined' ? undefined : r[item] , obj)
    } else {
      return undefined
    }
  }
}
