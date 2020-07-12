import React, { useState, useEffect, useRef, memo } from 'react'
import _ from 'lodash'
import fp from 'lodash/fp'
import sscanf from 'sscanf'
import nipplejs from 'nipplejs'
import classNames from 'classnames'
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

const ws = new WebSocket(`ws${location.protocol === 'https:' ? 's' : ''}://${location.host}/cmd`)

const stateMap = {
  0: 'IDLE',
  1: 'EXEC',
  3: 'MANUAL'
}

const MODE_IDLE = 'MODE_IDLE'
const MODE_BUSY_WAIT = 'MODE_BUSY_WAIT'
const MODE_BUSY = 'MODE_BUSY'
const MODE_MANUAL = 'MODE_MANUAL'
const MODE_CHOOSE_MOVE = 'MODE_CHOOSE_MOVE'
const MODE_CHOOSE_TURN = 'MODE_CHOOSE_TURN'
const MODE_CHOOSE_RESET = 'MODE_CHOOSE_RESET'

const Commands = memo(({ mode, setMode, setHistory }) => {
  const Button = ({ activeMode, onClick, children }) => (
    <button disabled={mode === MODE_BUSY || mode === MODE_BUSY_WAIT} onClick={onClick} className={classNames('menu-item', { active: mode === activeMode })}>{children}</button>
  )

  const move = (dis) => {
    setMode(MODE_BUSY_WAIT)
    ws.readyState === WebSocket.OPEN && ws.send(`${dis >=0 ? 'F' : 'B'}${parseInt(Math.abs(dis) * 10)}\n`)
  }

  const turn = (angle) => {
    setMode(MODE_BUSY_WAIT)
    ws.readyState === WebSocket.OPEN && ws.send(`${angle >=0 ? 'L' : 'R'}${parseInt(Math.abs(angle))}\n`)
  }

  const reset = () => {
    setMode(MODE_BUSY)
    ws.readyState === WebSocket.OPEN && ws.send('Z\n')
    setHistory({ n: [], volt: [], current: [], sound: [] })
  }

  let trans = 0
  switch (mode) {
    case MODE_CHOOSE_RESET:
      trans = -150
      break
    case MODE_CHOOSE_TURN:
      trans = 45
      break
    case MODE_CHOOSE_MOVE:
      trans = 100
      break
  }

  return (
    <div id='commands' className='menu'>
      <div className="menu-row" style={{transform: `translateX(${trans}px)`}}>
        {mode === MODE_CHOOSE_MOVE && <>
          <Button onClick={() => move(-50)}>-50cm</Button>
          <Button onClick={() => move(-20)}>-20cm</Button>
          <Button onClick={() => move(-10)}>-10cm</Button>
          <Button onClick={() => move(-5)}>-5cm</Button>
          <Button onClick={() => move(5)}>5cm</Button>
          <Button onClick={() => move(10)}>10cm</Button>
          <Button onClick={() => move(20)}>20cm</Button>
          <Button onClick={() => move(50)}>50cm</Button>
          <Button onClick={() => move(100)}>100cm</Button>
          <Button onClick={() => move(150)}>150cm</Button>
        </>}
        {mode === MODE_CHOOSE_TURN && <>
          <Button onClick={() => turn(90)}>L90°</Button>
          <Button onClick={() => turn(45)}>L45°</Button>
          <Button onClick={() => turn(30)}>L30°</Button>
          <Button onClick={() => turn(15)}>L15°</Button>
          <Button onClick={() => turn(5)}>L5°</Button>
          <Button onClick={() => turn(180)}>180°</Button>
          <Button onClick={() => turn(-5)}>R5°</Button>
          <Button onClick={() => turn(-15)}>R15°</Button>
          <Button onClick={() => turn(-30)}>R30°</Button>
          <Button onClick={() => turn(-45)}>R45°</Button>
          <Button onClick={() => turn(-90)}>R90°</Button>
        </>}
        {mode === MODE_CHOOSE_RESET && <>
          <Button onClick={reset}><span className='danger'>Reset</span></Button>
          <Button onClick={() => setMode(MODE_IDLE)}>Cancel</Button>
        </>}
      </div>

      <div className="menu-row">
        <Button activeMode={MODE_CHOOSE_RESET} onClick={() => setMode(MODE_CHOOSE_RESET)}>Reset</Button>
        <Button activeMode={MODE_MANUAL} onClick={() => setMode(MODE_MANUAL)}>Manual</Button>
        <Button activeMode={MODE_CHOOSE_TURN} onClick={() => setMode(MODE_CHOOSE_TURN)}>Turn</Button>
        <Button activeMode={MODE_CHOOSE_MOVE} onClick={() => setMode(MODE_CHOOSE_MOVE)}>Move</Button>
      </div>
    </div>
  )
})

export const App = () => {
  const [{ state, n, rpml, rpmr, disl, disr, temp, volt, current }, setStats] = useState({})
  const [history, setHistory] = useState({ n: [], volt: [], current: [], sound: [] })
  const [mode, setMode] = useState(MODE_MANUAL)

  useEffect(() => {
    ws.onmessage = data => {
      const [state, n, rpml, rpmr, disl, disr, temp, volt, current, sound] = sscanf(data.data, 'S%d;%d;%f;%f;%f;%f;%f;%f;%d;%f\n')
      setStats({ state, n, rpml, rpmr, disl, disr, temp, volt, current, sound })
      setHistory({
        n: _.takeRight([...history.n, n], 1000),
        current: _.takeRight([...history.current, current], HISTORY_LENGTH),
        sound: _.takeRight([...history.sound, sound], HISTORY_LENGTH),
        volt: _.takeRight([...history.volt, volt], 1000)
      })
      if (state === 1 && mode === MODE_BUSY_WAIT) {
        setMode(MODE_BUSY)
      }
      if (state === 0 && mode === MODE_BUSY) {
        setMode(MODE_IDLE)
      }
      if (state === 3 && (mode === MODE_BUSY_WAIT || mode === MODE_BUSY)) {
        setMode(MODE_MANUAL)
      }
    }
  }, [history, mode])

  const onMove = ({x, y}) => {
    const f = fp.flow(fp.clamp(-200, 200), parseInt)
    ws.readyState === WebSocket.OPEN && ws.send(`S${f(-200 * y + -200 * x)};${f(200 * y + -200 * x)}\n`)
  }

  const stop = () => {
    ws.readyState === WebSocket.OPEN && ws.send('E\n')
  }

  return (
    <>
      {n && <div id='stats'>
        <div className='legend'>
          <p>S:</p>
          <p>N:</p>
          <p>TDis:</p>
          <p>RPM:</p>
          <p>STemp:</p>
          <p>Bat:</p>
          <p>Cur:</p>
        </div>
        <div className='numbers'>
          <p>{stateMap[state] || state}</p>
          <p>{n}</p>
          <p>L{parseInt(disl / 10)} R{parseInt(disr / 10)}</p>
          <p>L{parseInt(rpml) * -1} R{parseInt(rpmr)}</p>
          <p>{temp.toFixed(1)}</p>
          <p>{volt.toFixed(1)}</p>
          <p>{(current / 1000).toFixed(3)}</p>
        </div>
        <div className='units'>
          <p>&nbsp;</p>
          <p>&nbsp;</p>
          <p>cm</p>
          <p>&nbsp;</p>
          <p>C</p>
          <p>V</p>
          <p>A</p>
        </div>
      </div>}

      <Charts history={history} />

      {mode === MODE_MANUAL && <Joystick onMove={onMove} />}

      <Commands mode={mode} setMode={setMode} setHistory={setHistory} />

      {state === 1 && <button id='stop' onClick={stop}>STOP</button>}
    </>
  )
}
