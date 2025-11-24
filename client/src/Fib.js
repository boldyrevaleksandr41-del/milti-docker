import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const Fib = () => {
  const [seenIndexes, setSeenIndexes] = useState([])
  const [values, setValues] = useState({})
  const [index, setIndex] = useState('')

  const fetchValues = useCallback(async () => {
    const values = await axios.get('/api/values/current')
    setValues(values.data)
  }, [])

  const fetchIndexes = useCallback(async () => {
    const seenIndexes = await axios.get('/api/values/all')
    setSeenIndexes(seenIndexes.data)
  }, [])

  const renderSeenIndexes = useCallback(() => {
    return seenIndexes.map(({ number }) => number).join(', ')
  }, [seenIndexes])

  const renderValues = useCallback(() => {
    const entries = []
    for (let key in values) {
      entries.push(
        <div key={key}>
          For index {key} I calculated {values[key]}
        </div>
      )
    }
    return entries
  }, [values])

  const onChangeInput = useCallback((event) => {
    setIndex(event.target.value)
  }, [setIndex])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()
    await axios.post('/api/values', {
      index: index
    })
    setIndex('')
  }, [index])

  useEffect(() => {
    fetchValues()

    fetchIndexes()
  }, [fetchValues, fetchIndexes])

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Enter your index</label>
        <input value={index} onChange={onChangeInput} />
        <button>Submit</button>
      </form>

      <h3>Indexes I have seen:</h3>
      { renderSeenIndexes() }
      <h3>Calculated values:</h3>
      { renderValues() }
    </div>
  )
}

export default Fib