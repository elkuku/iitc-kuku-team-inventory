#!/usr/bin/env node

import fs from 'fs'

function escapeHtml(value = '') {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

console.log('Generating GitHub page...')

const now = new Date()

const day = String(now.getDate()).padStart(2, '0')
const month = new Intl.DateTimeFormat('en', {month: 'long'}).format(now)
const year = now.getFullYear()

const formattedDate = `${day}-${month}-${year}`

fs.rmSync('gh_page', {recursive: true, force: true})
fs.mkdirSync('gh_page', {recursive: true})

fs.cpSync('.github/page', 'gh_page', {recursive: true})
fs.cpSync('build', 'gh_page/files', {recursive: true})

let releaseFiles = [], devFiles = []

if (fs.existsSync('build/release')) {
    releaseFiles = fs
        .readdirSync('build/release', {withFileTypes: true})
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
}

if (fs.existsSync('build/dev')) {
    devFiles = fs
        .readdirSync('build/dev', {withFileTypes: true})
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
}

const metaFile = releaseFiles.filter(fileName => fileName.endsWith('.meta.js'))[0]
let version = 'n/a'
if (metaFile) {
    const meta = fs.readFileSync(`build/release/${metaFile}`, 'utf8')
    const match = meta.match(/^\s*\/\/\s*@version\s+(.+)$/m)
    version = match ? match[1].trim() : 'n/a'
}

const pluginData = JSON.parse(
    fs.readFileSync('plugin.json', 'utf8'),
)

let releaseLinks = []
if (releaseFiles.length > 0) {
    releaseLinks = releaseFiles
        .filter(name => !name.endsWith('meta.js'))
        .map(name => `<li><a href="files/release/${name}">${name}</a></li>`)
        .join('\n')

} else {
    releaseLinks = '<li>No release yet</li>'
}

const devLinks = devFiles
    .filter(name => !name.endsWith('meta.js'))
    .map(name => `<li><a href="files/dev/${name}">${name}</a></li>`)
    .join('\n')

let template = fs.readFileSync('gh_page/index.html', 'utf8')

const projectName = pluginData.name.replace('IITC plugin: ', '')

const raw = fs.readFileSync('build/changelog.json', 'utf8')
const tags = JSON.parse(raw);
const changelog = tags.map(tag => `
      <tr>
        <td class="changelog-version">${escapeHtml(tag.name)}</td>
        <td class="changelog-date">${escapeHtml(tag.date)}</td>
        <td><pre class="changelog">${escapeHtml(tag.message)}</pre></td>
      </tr>
  `).join('')

template = template
    .replace('{{RELEASE_LINKS}}', releaseLinks)
    .replace('{{DEV_LINKS}}', devLinks)
    .replaceAll('{{PROJECT_NAME}}', projectName)
    .replaceAll('{{PROJECT_VERSION}}', version)
    .replaceAll('{{LAST_UPDATED}}', formattedDate)
    .replace('{{PROJECT_DESCRIPTION}}', pluginData.description)
    .replace('{{CHANGELOG}}', changelog)

fs.writeFileSync('gh_page/index.html', template, 'utf8')

console.log('Finished =;)')
