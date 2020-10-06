const isEmptyValue = require('./common').isEmptyValue

module.exports = {
  /**
   * 功能： 深拷贝，从源对象复制与目标对象相同的属性
   * @param {Object} target 目标对象
   * @param {Object} source 源对象
   * @param {Boolean} cloneEmpty 源值为空的时，true-拷贝源值到目标属性， false-不拷贝源值到目标属性
   * @param {Boolean} selfFirst 目标值不为空时，true-不覆盖目标值， false-覆盖目标值
   */
  same (target, source, cloneEmpty = true, selfFirst = false) {
    if (target === null || source === null) return
    if (typeof target !== 'object' || typeof source !== 'object') return

    let targetKeys = Object.keys(target)

    for (let [key, value] of Object.entries(source)) {
      if (targetKeys.includes(key)) {
        let targetValue = target[key]

        if (isEmptyValue(targetValue)) {
          // 处理所有目标值为空值的情况
          target[key] = value
        } else {
          // 目标属性值为对象
          if (typeof targetValue === 'object') {
            // 处理所有源值为空值的情况
            if (isEmptyValue(value)) {
              if (cloneEmpty) {
                target[key] = value
              } else {
                return
              }
            } else {
              if (typeof value === 'object') {
                this.same(targetValue, value)
              } else {
                target[key] = value
              }
            }
          } else {
            // 目标属性为非对象属性
            if (selfFirst) {
              return
            } else {
              target[key] = value
            }
          }
        }
      }
    }

    return target
  }
}
