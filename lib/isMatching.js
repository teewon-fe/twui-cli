
module.exports = function isMatching (pattern, value) {
  if (pattern !== null && typeof pattern === 'object') {
    if (pattern instanceof RegExp) {
      return pattern.test(value)
    } else if (Array.isArray(pattern)) {
      let result = false

      for (const item of pattern) {
        if (isMatching(item, value)) {
          result = true
          break
        }
      }

      return result
    } else {
      return false
    }
  } else {
    return pattern === value
  }
}
