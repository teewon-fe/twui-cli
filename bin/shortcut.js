#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
var exec = require('child_process').exec
var setSvnUrl = require('../lib/setSvnUrl')
var userHome = process.env.HOME || process.env.USERPROFILE
var configFile = path.resolve(process.env.HOME || process.env.USERPROFILE, './.twuirc')

fs.readFile(configFile, 'utf-8', (err, data) => {
  const syncShortcut = (svnUrl) => {
    const snippetsPath = path.resolve(`${userHome}\\.vscode\\extensions\\twfe.twui-snippets-0.0.1`)

    console.log('updating shortcut...')
    let cmd = `svn export --force "${svnUrl + '/app-template/twui-snippets'}" "${snippetsPath}"`
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(error)
      } else {
        console.log(`OK!\nReload the vscode to activate.`)
      }
    })
  }

  if (err) {
    setSvnUrl(syncShortcut)
  } else {
    try {
      const svnUrl = JSON.parse(data).svnUrl

      if (svnUrl) {
        syncShortcut(svnUrl)
      } else {
        setSvnUrl(syncShortcut)
      }
    } catch (e) {
      setSvnUrl(syncShortcut)
    }
  }
})
