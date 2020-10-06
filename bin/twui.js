#!/usr/bin/env node

var inquirer = require('inquirer')
var path = require('path')
var fs = require('fs')
var process = require('process')
var exec = require('child_process').exec
var cmdDir = process.cwd()
var cmdDirName = cmdDir.substr(cmdDir.lastIndexOf('\\') + 1)
var version = 'CCE V001R001C01'
var subDirs = ['代码', '低保真', '高保真', '过程文件', '交付', '源文件', '转测用例']
var setSvnUrl = require('../lib/setSvnUrl')
var configFile = path.resolve(process.env.HOME || process.env.USERPROFILE, './.twuirc')
var iconv = require('iconv-lite')
var args = process.argv.splice(2)[0]
var twuiVersion = require('../package.json').version

if (args === 'pull') {
  exec('svn update', (error, stdout, stderr) => {
    if (error) {
      console.error(error)
    } else {
      console.log('ok!\n' + stdout)
    }
  })

  return
}

if (args === '-v' || args === 'version') {
  console.log(twuiVersion)
  return
}

let templateDirs = {
  portal: ['common', 'single', 'web-app', 'portal-web-app'],
  admin: ['common', 'single', 'web-app', 'admin-web-app'],
  mobile: ['common', 'single', 'mobile-app'],
  mixed: ['common', 'multiple'],
  eco: ['common', 'single', 'web-app', 'eco-web-app'],
}

fs.readFile(configFile, 'utf-8', (err, data) => {
  let svn
  let appName
  let appDir
  let appSVN
  let checkoutMsg = '选择应用的类型'
  let checkoutChoices = [
    {
      name: '前台门户类应用',
      value: 'portal'
    },
    {
      name: '后台管理类应用',
      value: 'admin'
    },
    {
      name: '移动端应用',
      value: 'mobile'
    },
    {
      name: 'PC与移动端混合应用',
      value: 'mixed'
    },
    {
      name: '类ECO(深色)风格应用',
      value: 'eco'
    }
  ]

  const checkoutTemplate = function (hasSvn) {
    inquirer.prompt([
      {
        type: 'list',
        name: 'dir',
        message: checkoutMsg,
        'choices': checkoutChoices
      },
      {
        type: 'list',
        name: 'install',
        message: '是否自动安装插件，选【no】可之后手动运行cnpm install安装?',
        'choices': ['Yes', 'No']
      }
    ]).then(answers => {
      subDirs.forEach(dir => {
        fs.mkdirSync(path.resolve(appDir, dir))
      })

      const appCodeDir = path.resolve(appDir, '代码')

      if (!args) {
        fs.mkdirSync(path.resolve(appCodeDir, 'tags'))
        fs.mkdirSync(path.resolve(appCodeDir, 'branches'))
      }

      // const svnTemplate = args === 'clone' ? svn + '/' + answers.dir : svn + '/app-template/' + answers.dir
      const svnTemplates = args === 'clone' ? [svn + '/' + answers.dir] : templateDirs[answers.dir].map(item => svn + '/app-template/' + item)

      const install = function () {
        if (answers.install === 'Yes') {
          console.log(`插件安装中, 请稍候...`)
          exec(`cd ${appName ? appName + '/' : ''}代码/trunk && cnpm install`, (error, stdout, stderr) => {
            if (error) {
              console.error(error)
            } else {
              console.log(`ok!`)
            }
          })
        } else {
          console.log(`ok!`)
        }
      }

      let currentTempIndex = 0
      const loadingTemplate = function () {
        if (currentTempIndex === 0) {
          console.log(`模板下载中...`)
        }
        
        let currentTepmlate = svnTemplates[currentTempIndex]

        if (currentTepmlate) {
          let cmd = `svn export --force "${currentTepmlate}" "${path.resolve(appCodeDir, './trunk')}"`
          exec(cmd, (error, stdout, stderr) => {
            if (error) {
              console.error(error)
            } else {
              currentTempIndex++
              loadingTemplate()
            }
          })
        } else {
          install()
        }
      }

      if (hasSvn) {
        if (args === 'clone') {
          appSVN = `${svn}/${answers.dir}`
        }

        let cmd = `svn co "${appSVN}" "${appCodeDir}"`

        console.log(`checking out...`)
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error(error)
          } else {
            if (args === 'clone') {
              install()
            }

            if (!args) {
              loadingTemplate()
            }
          }
        })
      } else {
        loadingTemplate()
      }
    })
  }

  const clone = function (svnUrl) {
    let cmd = `svn list "${svnUrl}" --verbose`

    exec(cmd, {encoding: 'binary'}, (error, stdout, stderr) => {
      if (error) {
        console.log('Svn checkout failed.')
      } else {
        stdout = iconv.decode(Buffer.from(stdout, 'binary'), 'cp936')
        let list = stdout.split(/\r?\n/)
        let dirs = []

        list.forEach(item => {
          let props = item.split(/\s+/)

          if (props[6]) {
            let name = props[6].replace(/\.?\/$/, '')

            if (name) {
              dirs.push({
                name,
                version: parseInt(props[1])
              })
            }
          }
        })

        dirs.sort((a, b) => b.version - a.version)
        checkoutMsg = 'Pick a project'
        checkoutChoices = dirs.map(item => item.name)
        checkoutTemplate(true)
      }
    })
  }

  const setAppName = (svnUrl) => {
    svn = svnUrl

    let prompts = [
      {
        type: 'input',
        name: 'name',
        message: args === 'clone' ? `请选择项目的SVN目录名称(${cmdDirName}):` : `请输入应用名称(${cmdDirName}):`
      }
    ]

    if (!args) {
      prompts.push({
        type: 'input',
        name: 'version',
        message: `应用的版本号，注意为公司项目的版本号格式，如(${version}):`
      })
    }

    inquirer.prompt(prompts).then(answers => {
      appName = answers.name
      appDir = path.resolve(cmdDir, answers.name || '')

      if (answers.name) {
        fs.mkdirSync(appDir)
      }

      if (args === 'clone') {
        clone(svnUrl)
        return
      }

      inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: '在哪里创建目录?',
          choices: [
            {
              name: '仅本地',
              value: 'local only'
            },
            {
              name: 'SVN和本地',
              value: 'local and svn'
            }
          ]
        }
      ]).then(directory => {
        version = answers.version || version

        if (directory.type === 'local only') {
          checkoutTemplate()
        }

        if (directory.type === 'local and svn') {
          inquirer.prompt([
            {
              type: 'input',
              name: 'username',
              message: `svn用户名:`
            },
            {
              type: 'input',
              name: 'password',
              message: `svn密码:`
            }
          ]).then(user => {
            console.log(`正在建立SVN目录...`)
            appSVN = `${svn}/${answers.name || cmdDirName}`
            let cmd = `svn import --username ${user.username} --password ${user.password} -m "【版本】 ${version} 【单号】 EBAG-0 【描述】 建立应用目录" "${appDir}" "${appSVN}"`
            let svnSuccess = false

            exec(cmd, (error, stdout, stderr) => {
              svnSuccess = true
              if (error) {
                console.error(error)
              } else {
                checkoutTemplate(true)
              }
            })

            setTimeout(() => {
              if (!svnSuccess) {
                throw new Error('SVN用户名或密码错误.')
              }
            }, 15000)
          })
        }
      })
    })
  }

  if (err) {
    setSvnUrl(setAppName)
  } else {
    try {
      const svnUrl = JSON.parse(data).svnUrl

      if (svnUrl) {
        setAppName(svnUrl)
      } else {
        setSvnUrl(setAppName)
      }
    } catch (e) {
      setSvnUrl(setAppName)
    }
  }
})
