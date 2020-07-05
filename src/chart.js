import _ from 'lodash'
import React from 'react'
import Plotly from 'plotly.js-basic-dist'
import createPlotlyComponent from 'react-plotly.js/factory'

const Plot = createPlotlyComponent(Plotly)

export const Chart = ({ y, x, name, color = 'white', min, max, line, type = 'scatter' }) => (
  <div className='chart'>
    <h3>{name}</h3>
    <Plot
      useResizeHandler
      data={[
        {
          y,
          x,
          type,
          mode: 'lines',
          name,
          marker: { color }
        }
      ]}
      layout={{
        showlegend: false,
        plot_bgcolor: 'transparent',
        autosize: true,
        margin: {
          l: 0,
          r: 0,
          b: 0,
          t: 0,
          pad: 0
        },
        yaxis: {
          range: [min, _.max([max, ...y])],
          showgrid: false,
          showline: false,
          zeroline: false,
          visible: false,
          autorange: !min && !max
        },
        xaxis: {
          visible: false
        },
        shapes: line && [
          {
            type: 'line',
            xref: 'paper',
            x0: 0,
            y0: line,
            x1: 1,
            y1: line,
            line: {
              color: 'white',
              width: 1
            }
          }
        ]
      }}
      config={{
        displayModeBar: false
      }}
    />
  </div>
)
