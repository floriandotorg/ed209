const express = require('express')
const app = express()

const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const compiler = webpack(webpackConfig)

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo: true, publicPath: webpackConfig.output.publicPath
}))
app.use(require('webpack-hot-middleware')(compiler))

const videoStream = require('raspberrypi-node-camera-web-streamer')
videoStream.acceptConnections(app, {
    width: 1280,
    height: 720,
    fps: 25,
    encoding: 'JPEG',
    quality: 7
}, '/stream.mjpg', false)

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
const wss = new ws.Server({ server })

wss.on('connection', (socket) => {
  socket.on('message', message => port.write(message))
  sockets.push(socket)
})

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server started on port ${server.address().port} :)`)
  setInterval(() => port.write('G\n'), 300)
})
