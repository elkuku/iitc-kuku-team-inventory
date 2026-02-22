#!/usr/bin/env node

import {execSync} from 'node:child_process'
import {resolve} from 'node:path'
import fs from 'fs'

if (!fs.existsSync('build')) fs.mkdirSync('build')

function getTags() {

    const gitCommand = [
        'git for-each-ref refs/tags',
        '--sort=-taggerdate',
        '--format="%(refname:strip=2)%00%(taggerdate:format:%Y-%b-%d)%00%(contents)%00"',
    ].join(' ')

    const output = execSync(gitCommand, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    })

    if (!output) {
        return []
    }

    const fields = output.trim().split('\0').filter(Boolean)
    const tags = []

    for (let i = 0; i < fields.length; i += 3) {
        const name = fields[i].trim()
        const date = fields[i + 1].trim()
        const message = fields[i + 2]?.trim() ?? ''

        if (name) tags.push({name, date, message})
    }

    return tags
}

function writeJsonFile(data, filename = 'build/changelog.json') {
    const filePath = resolve(process.cwd(), filename)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    console.log(`changelog written to ${filePath}`)
}

try {
    const tags = getTags()
    writeJsonFile(tags)
} catch (err) {
    console.error('Failed to read tags:', err.message)
    process.exit(1)
}
