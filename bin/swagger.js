#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const swagger = require('swagger-parser')
const cmdDir = process.cwd()
const args = process.argv.splice(2)
const assign = require('../lib/assign')
const createEnv = require('../lib/env')
const propChain = require('../lib/propChain')
const isMatching = require('../lib/isMatching')

require('colors')
createEnv(path.join(cmdDir, './.env'))

let defaultOutputDir = './src/api'
let currApiUrl = ''
let currApiMode = 'body'
let currDir = ''
let tagApis = []

let localConfig
try {
  localConfig = require(path.join(cmdDir, 'twui.config.js')).swagger
} catch (err) {
  localConfig = {}
}

let config = {
  docs: [],
  ignoreUrl: localConfig.ignoreUrl || null,
  flatten: {
    enable: true,
    defaultKey: 'responseEntity',
    pageableKey: 'pageInfo'
  },
  ignoreHeader: {
    enable: true,
    excludeUrl: []
  },
  ignoreArray: {
    enable: true,
    excludeUrl: []
  },
  ignoreProps: ['serverResult'],
  pageableApi: {
    key: localConfig.pageableApi ? localConfig.pageableApi.key : 'responses.200.schema.properties.pageInfo',
    descKeyword: '分页接口',
    urls: [],
    validator (data, url) {
      return data.description && data.description.includes(config.pageableApi.descKeyword)
    }
  },
  default: {
    pageNum: 1,
    pageSize: 20
  },
  mergeExport: true,
  space: {
    params: 4,
    data: 4
  }
}

Object.assign(config.docs, localConfig.docs)
Object.assign(config.flatten, localConfig.flatten)
Object.assign(config.ignoreHeader, localConfig.ignoreHeader)
Object.assign(config.ignoreArray, localConfig.ignoreArray)
Object.assign(config.pageableApi, localConfig.pageableApi)
Object.assign(config.space, localConfig.space)
Object.assign(config.default, localConfig.default)

if (args[0]) {
  config.docs = [args[0]]
}

if (args[1]) {
  defaultOutputDir = args[1]
}

if (config.docs.length === 0) {
  console.error('Please spicify api docs in twui.config.js!')
  return
}

const genDefault = function (str, propName) {
  if (config.default[propName] !== undefined) {
    return config.default[propName]
  }

  if (str.startsWith('integer') || str.startsWith('float') || str.startsWith('number') || str.startsWith('double')) {
    return 0
  } else if (str === 'string') {
    return ''
  } else if (str === 'boolean') {
    return false
  } else if (str === 'object') {
    return {}
  } else if (str === 'array') {
    return []
  } else {
    return undefined
  }
}

const isExcluded = function (excludeRoles) {
  for (const item of excludeRoles) {
    if (typeof item === 'string') {
      if (currApiUrl === item) {
        return true
      }
    }

    if (item instanceof RegExp) {
      if (item.test(currApiUrl)) {
        return true
      }
    }
  }

  return false
}

const genApiProp = function (data, target) {
  let result = target || {}

  if (data) {
    let keys = Object.keys(data)

    keys.reduce((prev, key) => {
      let item = data[key]
      item.name = item.name || key

      if (config.ignoreProps.includes(item.name)) {
        return
      }

      if (item.schema) {
        if (item.in === 'body') {
          if (item.schema.properties) {
            genApiProp(item.schema.properties, prev)
          } else {
            prev[item.name] = genDefault(item.schema.type, item.name)
          }
        } else {
          prev[item.name] = genDefault(item.schema.type, item.name)
          if (item.schema.properties) {
            genApiProp(item.schema.properties, prev[item.name])
          }
        }
      } else {
        if (item.in === 'header') {
          if (!config.ignoreHeader.enable || isExcluded(config.ignoreHeader.excludeUrl)) {
            prev[item.name] = genDefault(item.type, item.name)
          }
        } else {
          if (item.type === 'array') {
            prev[item.name] = genDefault(item.type, item.name)

            if (!config.ignoreArray.enable || isExcluded(config.ignoreArray.excludeUrl)) {
              if (item.items.properties) {
                prev[item.name].push(genApiProp(item.items.properties))
              }
            }
          } else if (item.type === 'object') {
            prev[item.name] = genDefault(item.type, item.name)
            if (item.properties) {
              genApiProp(item.properties, prev[item.name])
            }
          } else {
            prev[item.name] = genDefault(item.type, item.name)
          }
        }
      }

      if (item.in) currApiMode = item.in

      return prev
    }, result)

    return result
  }
}

const mkDirs = function (dirpath) {
  if (!fs.existsSync(path.dirname(dirpath))) {
    mkDirs(path.dirname(dirpath))
  }

  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath)
  }
}

const format = function (content, space) {
  if (content) {
    let result = content.replace(/^(\s+)"(\w+)":/gm, '$1$2:').replace(/"/gm, "'") + '\n'

    if (space) {
      result = result.replace(/^\s/gm, `${' '.repeat(space + 1)}`).replace(/^}/m, `${' '.repeat(space)}}`)
    }

    return result
  } else {
    '{}'
  }
}

const unFormat = function (content) {
  return content.replace(/^(\s+)(\w+):/gm, '$1"$2":').replace(/'/gm, '"') + '\n'
}

const mergeAndExport = function (dirPath) {
  try {
    if (config.mergeExport) {
      if (currDir !== dirPath) {
        if (currDir !== '' && tagApis.length > 0) {
          let indexFile = path.join(currDir, 'index.js')

          if (fs.existsSync(indexFile)) {
            let apis = fs.readFileSync(indexFile, 'utf-8')
              .replace(/export \* from '.\//gm, '')
              .replace(/'/gm, '').split('\n')

            apis = new Set(apis)
            apis.delete('')
            tagApis = [...new Set(tagApis.concat([...apis]))]
          }

          fs.writeFileSync(path.join(currDir, 'index.js'), tagApis.map(item => `export * from './${item}'`).join('\n') + '\n')
        }

        currDir = dirPath
        tagApis = []
      }
    }
  } catch (err) {
    console.log(err)
  }
}

const syncApiFile = function (data, url, method, output) {
  // 【/url/{userId}?type=3】 to url
  let subPath = url.replace(/\/{\w+}/, '').replace(/\/?\w*$/, '')
  subPath = subPath || (data.tags && data.tags[0] ? data.tags[0].replace(/-?controller$/, '') : '')
  subPath = subPath
    .replace(/^\//, './')
    .replace(/^(\w)/, (m, p1) => p1.toLowerCase())
    .replace(/\/(\w)/, (m, p1) => `/${p1.toLowerCase()}`)
    .replace(/([A-Z])/g, (m, p1) => `-${p1.toLowerCase()}`)

  let fileName = url.replace(/\/{\w+}/, '').replace(/.*\//, '')

  if (fileName === 'delete') {
    fileName = 'del'
  }

  const dirPath = path.join(output, subPath)
  const filePath = path.join(dirPath, fileName + '.js')

  mkDirs(dirPath)

  let comment = `// ${data.summary}\n`
  let exportRow = `export const ${fileName} = `
  let paramSchema = genApiProp(data.parameters)
  let dataSchema = {}

  if (data.responses['200'].schema && data.responses['200'].schema.properties) {
    dataSchema = genApiProp(data.responses['200'].schema.properties)
  } else {
    if (data.responses['200'].properties) {
      dataSchema = genApiProp(data.responses['200'].properties)
    }
  }

  let schema = {
    url,
    method
  }

  let pageable = false

  if (propChain.get(data, config.pageableApi.key) || isMatching(config.pageableApi.urls, url) || (config.pageableApi.validator && config.pageableApi.validator(data, url))) {
    pageable = true
  }

  if (pageable) {
    schema.pageable = true
  }

  dataSchema = config.flatten.enable
    ? pageable ? propChain.get(dataSchema, config.flatten.pageableKey) : propChain.get(dataSchema, config.flatten.defaultKey)
    : dataSchema

  Object.assign(schema, {
    request: {
      mode: currApiMode,
      params: paramSchema
    },
    response: {
      data: dataSchema || {}
    }
  })

  mergeAndExport(dirPath)
  tagApis.push(fileName)

  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf-8').replace(/^\s{2}method:.*$/m, `  method: '${method}',`)

      if (pageable) {
        content = content.replace(/^\s{2}pageable:.*$/m, `  pageable: true,`)
      }

      const paramsRegx = new RegExp(`^\\s{${config.space.params}}params:((.*?})|(.*\\n(.*\\n)*?\\s{4}}))\\n`, 'm')
      const dataRegx = new RegExp(`^\\s{${config.space.data}}data:((.*?})|(.*\\n(.*\\n)*?\\s{4}}))\\n`, 'm')
      let fileParams = content.match(paramsRegx)
      let fileData = content.match(dataRegx)

      if (fileParams && fileParams[1]) {
        fileParams = JSON.parse(unFormat(fileParams[1]))
      }

      if (fileData && fileData[1]) {
        fileData = JSON.parse(unFormat(fileData[1]))
      }

      assign.same(paramSchema, fileParams)
      assign.same(dataSchema, fileData)

      if (paramSchema) {
        content = content
        .replace(paramsRegx, `    params: ${format(JSON.stringify(paramSchema, null, 2), config.space.params)}`)
      }

      if (dataSchema) {
        content = content
        .replace(dataRegx, `    data: ${format(JSON.stringify(dataSchema, null, 2), config.space.data)}`)
      }

      fs.writeFileSync(filePath, content)
      console.log('File: '.green + `${filePath.blue}` + ` has been synced.`)
    } else {
      let content = format(comment + exportRow + JSON.stringify(schema, null, 2))

      fs.writeFileSync(filePath, content)
      console.log(`${currApiUrl.green} ${'=>'.yellow} ${filePath.blue}`)
    }
  } catch (err) {
    console.error(err)
  }
}

const validateApi = function (index) {
  if (index < config.docs.length) {
    const doc = config.docs[index]
    let docPath = ''
    let outputDir = defaultOutputDir

    if (typeof doc === 'string') {
      docPath = doc
    }

    if (typeof doc === 'object') {
      docPath = doc.path
      outputDir = doc.outputDir || defaultOutputDir
    }

    if (!docPath) {
      console.error('Please specify the api doc path of swagger2+.')
      return
    }

    if (!docPath.startsWith('http://') && !docPath.startsWith('https://')) {
      docPath = path.resolve(cmdDir, docPath)
    }

    outputDir = path.join(cmdDir, outputDir)

    swagger.validate(docPath, (err, api) => {
      if (err) {
        console.log(err)
      } else {
        for (const [url, methods] of Object.entries(api.paths)) {
          for (const [method, data] of Object.entries(methods)) {
            if (!isMatching(config.ignoreUrl, url)) {
              currApiUrl = url
              syncApiFile(data, url, method, outputDir)
            }
          }
        }

        mergeAndExport()
        validateApi(index + 1)
      }
    })
  }
}

validateApi(0)
