const fs = require('fs')

module.exports = function (envPath) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    let envs = content.replace(/\r/gm, '').split(/\n/)

    envs.forEach(env => {
      /* eslint-disable */
      if (env) {
        let [str, key, value] = env.match(/(.+)=(.+)$/)
        if (!process.env[key] && value) {
          process.env[key] = value
        }
      }
    })
  }
}



