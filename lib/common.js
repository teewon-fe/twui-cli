/**
 * 功能：判断一个值是否为空值
 * @param {*} val 需要判断的值
 */
function isEmptyValue (val) {
  if (Array.isArray(val)) {
    return val.length === 0
  } else {
    return [null, undefined, ''].includes(val)
  }
}

module.exports = {
  isEmptyValue
}
