#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const request = require('request')
const process = require('process')
const cmdDir = process.cwd()
const config = require(path.join(cmdDir, 'twui.config.js'))
const twfe = config.twfe
const inquirer = require('inquirer')
const dateFormat = require('../lib/data-format').dateFormat
const headers = {
  'session-id': '80791799'
}

const args = process.argv.splice(2)[0]

const writeConfig = function () {
  fs.writeFileSync(path.join(cmdDir, 'twui.config.js'), 'module.exports = ' + JSON.stringify(config, null, 2))
}

const pullPlan = function (projectId) {
  request({
    url: `${twfe.gateway}/project/plans?projectId=${projectId}`,
    method: 'get',
    headers
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      fs.exists(path.join(cmdDir, 'work-plans'), function (exists){
        if (!exists) {
          fs.mkdirSync(path.join(cmdDir, 'work-plans'))
        }

        const list = JSON.parse(body).data.list
        const developerPlans = {}
        twfe.developers = []

        for (const task of list) {
          if (task.developer_name) {
            if (!developerPlans[task.developer_name]) {
              twfe.developers.push(task.developer_name)
              developerPlans[task.developer_name]=[]
            }
  
            developerPlans[task.developer_name].push({
              id: task.id,
              name: task.task_name,
              startTime: dateFormat(new Date(task.start_time), 'yyyy-mm-dd HH:MM'),
              endTime: dateFormat(new Date(task.end_time), 'yyyy-mm-dd HH:MM'),
              progress: task. progress
            })
          }          
        }

        for (const [name, plans] of Object.entries(developerPlans)) {
          fs.writeFileSync(path.join(cmdDir, `work-plans/${name}.json`), JSON.stringify(plans, null, 2))
        }

        writeConfig()
        console.log('更新成功')
      })
    } else {
      console.log('更新失败')
    }
  })
}

const requestProjects = function () {
  request({
    url: `${twfe.gateway}/project/list?status=doing`,
    method: 'get',
    headers
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      const projects = JSON.parse(body).data.list

      if (twfe.projectId) {
        pullPlan(twfe.projectId)
      } else {
        inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: '请选择要下载的项目',
            choices: projects.map(item=>({name:item.project_name, value: JSON.stringify(item)}))
          }
        ]).then(answer=>{
          const project = JSON.parse(answer.project)
          twfe.projectId = project.id
          twfe.leader = project.project_leader_name

          pullPlan(project.id)
        })
      }
    }
  })
}

const getTimeNodes = function () {
  request({
    url: `${twfe.gateway}/project/timenodes?projectId=${twfe.projectId}`,
    method: 'get',
    headers
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      const list = JSON.parse(body).data.list

      for (const timeNode of list) {
        const timeNodeStartTime = new Date(timeNode.start_time)

        if (Date.now()-timeNodeStartTime>=0 && !timeNode.done_time) {

        }
      }

      inquirer.prompt([
        {
          type: 'list',
          name: 'project',
          message: '请选择要下载的项目',
          choices: projects.map(item=>({name:item.project_name, value: JSON.stringify(item)}))
        }
      ]).then(answer=>{
        const project = JSON.parse(answer.project)
        twfe.projectId = project.id
        twfe.leader = project.project_leader_name

        pullPlan(project.id)
      })
    } else {
      console.log('获取里程碑列表失败')
    }
  })
}

const pushPlans = function (name) {
  const body = fs.readFileSync(path.join(cmdDir, `work-plans/${name}.json`), 'utf-8')

  request({
    url: `${twfe.gateway}/project/plans`,
    method: 'put',
    headers: {
      'session-id': '80791799',
      'content-type': 'application/json'
    },
    body
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log('提交成功')
    } else {
      console.log('提交失败')
    }
  })

  if (twfe.leader === name) {
    getTimeNodes()
  }
}

if (args === 'pull') {
  requestProjects()
} else {
  if (twfe.developers) {
    if (twfe.developer) {
      pushPlans(twfe.developer)
    } else {
      inquirer.prompt([
        {
          type: 'list',
          name: 'developer',
          message: '请选择开发',
          choices: twfe.developers.map(item=>({name:item,value:item}))
        }
      ]).then(answer => {
        twfe.developer = answer.developer
        writeConfig()
        pushPlans(answer.developer)
      })
    }
  } else {
    requestProjects()
  }
}