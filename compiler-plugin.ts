import { plugin } from 'bun'
import { transformSync } from '@babel/core'

plugin({
  name: 'react-compiler',
  setup(build) {
    const projectDir = import.meta.dir
    build.onLoad({ filter: /\.tsx$/ }, async ({ path }) => {
      // Only transform files in this directory, not node_modules
      if (!path.startsWith(projectDir)) return
      const source = await Bun.file(path).text()
      const result = transformSync(source, {
        filename: path,
        presets: [
          ['@babel/preset-react', { runtime: 'automatic' }],
          ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
        ],
        plugins: [
          ['babel-plugin-react-compiler', { target: '18' }],
        ],
      })
      return { contents: result!.code!, loader: 'js' }
    })
  },
})
