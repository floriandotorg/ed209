import React, { useState, useEffect, useRef } from 'react'
import _ from 'lodash'
import fp from 'lodash/fp'
import sscanf from 'sscanf'
import nipplejs from 'nipplejs'
import { Chart } from './chart'

const Joystick = ({ onMove }) => {
  const ref = useRef(null)
  const notify = _.throttle(onMove, 500)

  useEffect(() => {
    const manager = nipplejs.create({
      zone: ref.current,
      mode : 'semi'
    })
    manager.on('move', (_, { vector }) => notify(vector))
    manager.on('end', () => notify({ x: 0, y: 0 }))
  }, [])

  return (
    <div id='joystick-canvas' ref={ref} />
  )
}

const HISTORY_LENGTH = 25

const Charts = ({ history: { n, volt, current, sound } }) => {
  const nn = _.takeRight(n, HISTORY_LENGTH)

  return (
    <div id="charts">
      <Chart
        name='Volt (V)'
        x={n}
        y={volt}
        min={10}
        max={16}
      />
      <Chart
        name='Current (mA)'
        x={nn}
        y={current}
        min={-3000}
        max={5000}
      />
      <Chart
        name='Sound Level'
        x={nn}
        y={sound}
        type='bar'
        min={0.5}
        max={1}
      />
    </div>
  )
}

const ws = new WebSocket(`ws${location.protocol === 'https:' ? 's' : ''}://${location.host}`)

export const App = () => {
  const [{ n, rpml, rpmr, srpml, srpmr, temp, volt, current }, setStats] = useState({})
  const [history, setHistory] = useState({ n: [], volt: [], current: [], sound: [] })

  useEffect(() => {
    ws.onmessage = data => {
      const [n, rpml, rpmr, srpml, srpmr, temp, volt, current, sound] = sscanf(data.data, 'S%d;%d;%d;%d;%d;%f;%f;%d;%f\n')
      setStats({ n, rpml, rpmr, srpml, srpmr, temp, volt, current, sound })
      setHistory({
        n: _.takeRight([...history.n, n], 1000),
        current: _.takeRight([...history.current, current], HISTORY_LENGTH),
        sound: _.takeRight([...history.sound, sound], HISTORY_LENGTH),
        volt: _.takeRight([...history.volt, volt], 1000)
      })
    }
  }, [history])

  const onMove = ({x, y}) => {
    const f = fp.flow(fp.clamp(-200, 200), parseInt)
    ws.readyState === WebSocket.OPEN && ws.send(`S${f(-200 * y + -200 * x)};${f(200 * y + -200 * x)}\n`)
  }

  return (
    <>
      {n && <div id='stats'>
        <div className='legend'>
          <p>N:</p>
          <p>SRPM:</p>
          <p>RPM:</p>
          <p>STemp:</p>
          <p>Bat:</p>
          <p>Cur:</p>
        </div>
        <div className='numbers'>
          <p>{n}</p>
          <p>L{parseInt(srpml) * -1} R{parseInt(srpmr)}</p>
          <p>L{parseInt(rpml) * -1} R{parseInt(rpmr)}</p>
          <p>{temp.toFixed(1)}</p>
          <p>{volt.toFixed(1)}</p>
          <p>{(current / 1000).toFixed(3)}</p>
        </div>
        <div className='units'>
          <p>&nbsp;</p>
          <p>&nbsp;</p>
          <p>&nbsp;</p>
          <p>C</p>
          <p>V</p>
          <p>A</p>
        </div>
      </div>}

      <Charts history={history} />

      <Joystick onMove={onMove} />
    </>
  )
}
