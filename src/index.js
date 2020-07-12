import React from 'react'

// const whyDidYouRender = require('@welldone-software/why-did-you-render')
// whyDidYouRender(React, {
//   trackAllPureComponents: true
// })

import ReactDOM from 'react-dom'
import './index.scss'
import { App } from './app'

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)

import WSAvcPlayer from 'ws-avc-player'

const wsavc = new WSAvcPlayer({useWorker:false})
document.getElementById('video-box').appendChild(wsavc.AvcPlayer.canvas)
wsavc.connect(`ws${location.protocol === 'https:' ? 's' : ''}://${location.host}/video`)
