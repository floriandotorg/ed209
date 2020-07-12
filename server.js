const express = require('express')
const app = express()

const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const compiler = webpack(webpackConfig)

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo: true, publicPath: webpackConfig.output.publicPath
}))
app.use(require('webpack-hot-middleware')(compiler))

const sockets = []

const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

let port
const connect = () => {
  port = new SerialPort('/dev/ttyUSB0', {
    baudRate: 19200
  }, false)
  port.on('open', () => {
    const parser = port.pipe(new Readline({ delimiter: '\r\n' }))
    parser.on('data', (data) => {
      console.log(data)
      sockets.forEach(s => s.send(data))
    })
  })
  port.on('close', (err) => {
    console.log(err)
    setTimeout(connect, 1000)
  })
  port.on('error', (err) => {
    console.log(err)
    setTimeout(connect, 1000)
  })
  port.open((err) => {
    console.log(err)
    if (err?.message.includes('No such file or directory')) {
      setTimeout(connect, 1000)
    }
  })
}
connect()

const http = require('http')
const server = http.createServer(app)

const ws = require('ws')
const wss = new ws.Server({ noServer: true })
wss.on('connection', (socket) => {
  socket.on('message', message => port.write(message))
  sockets.push(socket)
})

const video_width = 1280
const video_height = 720

const AvcServer = require('ws-avc-player/lib/server')
const vwss = new ws.Server({ noServer: true })
const avcServer = new AvcServer(vwss, video_width, video_height)

const spawn = require('child_process').spawn
const raspivid = spawn('raspivid', [ '-pf', 'baseline', '-ih', '-t', '0', '-w', video_width, '-h', video_height, '-hf', '-fps', '20', '-g', '30', '-o', '-' ])
raspivid.on('exit', (code) => {
  console.error('raspivid failed: ', code)
})
raspivid.on('close', () => {
  console.error('raspivid failed')
})

avcServer.setVideoStream(raspivid.stdout)

const url = require('url')

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname

  if (pathname === '/video') {
    vwss.handleUpgrade(request, socket, head, (ws) => {
      vwss.emit('connection', ws, request)
    })
  } else if (pathname === '/cmd') {
    wss.handleUpgrade(request, socket, head,(ws) => {
      wss.emit('connection', ws, request)
    })
  } else {
    socket.destroy()
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${server.address().port} :)`)
  setInterval(() => port.write('G\n'), 300)
})
