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
const tags = JSON.parse(raw)

let version = 'n/a', releaseDate = 'n/a'

if (tags[0]) {
    version = tags[0].name
    releaseDate = tags[0].date
} else {
    const metaFile = releaseFiles.filter(fileName => fileName.endsWith('.meta.js'))[0]
    if (metaFile) {
        const meta = fs.readFileSync(`build/release/${metaFile}`, 'utf8')
        const match = meta.match(/^\s*\/\/\s*@version\s+(.+)$/m)
        version = match ? match[1].trim() : 'n/a'
    }
}

const changelog = tags.map(tag => `
      <tr>
        <td class="changelog-version">${escapeHtml(tag.name)}</td>
        <td class="changelog-date">${escapeHtml(tag.date)}</td>
        <td><pre class="changelog">${escapeHtml(tag.message)}</pre></td>
      </tr>
  `).join('')

let coverageSummary = '<p>No coverage report available.</p>'
if (fs.existsSync('coverage/coverage-summary.json')) {
    const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'))
    const total = summary.total
    const fmt = (metric) => {
        const pct = metric.pct.toFixed(1)
        const color = metric.pct >= 80 ? '#4caf50' : metric.pct >= 60 ? '#ff9800' : '#f44336'
        return `<td style="color:${color};font-weight:bold">${pct}%</td><td style="opacity:.7">${metric.covered}/${metric.total}</td>`
    }
    coverageSummary = `
<table class="changelog-table">
  <thead>
    <tr>
      <th>Metric</th><th>Coverage</th><th>Covered/Total</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Statements</td>${fmt(total.statements)}</tr>
    <tr><td>Branches</td>${fmt(total.branches)}</tr>
    <tr><td>Functions</td>${fmt(total.functions)}</tr>
    <tr><td>Lines</td>${fmt(total.lines)}</tr>
  </tbody>
</table>
<p><a href="coverage/">Full coverage report &rarr;</a></p>`
}

template = template
    .replace('{{RELEASE_LINKS}}', releaseLinks)
    .replace('{{DEV_LINKS}}', devLinks)
    .replaceAll('{{PROJECT_NAME}}', projectName)
    .replaceAll('{{PROJECT_VERSION}}', version)
    .replaceAll('{{RELEASE_DATE}}', releaseDate)
    .replaceAll('{{LAST_UPDATED}}', formattedDate)
    .replace('{{PROJECT_DESCRIPTION}}', pluginData.description)
    .replace('{{CHANGELOG}}', changelog)
    .replace('{{COVERAGE_SUMMARY}}', coverageSummary)

fs.writeFileSync('gh_page/index.html', template, 'utf8')

// Write plugin.json for the aggregator index (https://elkuku.github.io/iitc-plugins/)
const aggregatorMeta = {
    name:        pluginData.name,
    id:          pluginData.id,
    category:    pluginData.category,
    description: pluginData.description,
    author:      pluginData.author,
    downloadURL: pluginData.downloadURL,
    version:     version !== 'n/a' ? version : undefined,
    publishedAt: releaseDate !== 'n/a' ? releaseDate : undefined,
}

// Remove undefined fields
Object.keys(aggregatorMeta).forEach(k => aggregatorMeta[k] === undefined && delete aggregatorMeta[k])

fs.writeFileSync('gh_page/plugin.json', JSON.stringify(aggregatorMeta, null, 2), 'utf8')

console.log('Finished =;)')
