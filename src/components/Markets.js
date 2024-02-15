import { useSelector, useDispatch } from 'react-redux'
import config from '../config.json'
import { loadTokens } from "../store/interactions"

const Markets = () => {
  const provider = useSelector(state => state.provider.connection)
  const chainId = useSelector(state => state.provider.chainId)
  const dispatch = useDispatch()

  const marketHandler = async (e) => {
    loadTokens(provider, (e.target.value).split(','), dispatch)
  }

  return (
    <div className='component exchange__markets'>
      <div className='component__header'>
        <h2>Select Market</h2>
      </div>

      {chainId && config[chainId] && config[chainId].PRO && config[chainId].mETH  ? (
        <select name="markets" id="markets" onChange={marketHandler}>
          <option value={`${config[chainId].PRO.address},${config[chainId].mETH.address}`}>PRO / mETH</option>
          <option value={`${config[chainId].PRO.address},${config[chainId].mDAI.address}`}>PRO / mDAI</option>
          <option value={`${config[chainId].PRO.address},${config[chainId].mDApp.address}`}>PRO / mDApp</option>
        </select>
      ) : (
        <div>
          <p>Not Deployed to Network</p>
        </div>
      
      )}

      <hr />
    </div>
  )
}

export default Markets;
