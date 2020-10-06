#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var homePath = process.env.HOME || process.env.USERPROFILE
var inquirer = require('inquirer')
var configFile = path.resolve(homePath, './.twuirc')

module.exports = function setSvnUrl (callback) {
  inquirer.prompt([
    {
      type: 'input',
      name: 'templateSVN',
      message: 'app template svn path:'
    }
  ]).then(answers => {
    const svnUrl = answers.templateSVN.replace(/"/g, '')

    fs.writeFile(configFile, JSON.stringify({svnUrl}), 'utf-8', (err) => {
      if (err) console.log('svn path is not saved!')
    })

    callback(svnUrl)
  })
}
