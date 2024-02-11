import { createSelector } from 'reselect'
import { get, groupBy, reject, maxBy, minBy } from 'lodash';
import moment from 'moment'
import { ethers } from 'ethers';

const GREEN = '#25CE8F'
const RED = '#F45353'

const account = state => get(state, 'provider.account')
const tokens = state => get(state, 'tokens.contracts')

const allOrders = state => get(state, 'exchange.allOrders.data', [])
const cancelledOrders = state => get(state, 'exchange.cancelledOrders.data', [])
const filledOrders = state => get(state, 'exchange.filledOrders.data', [])


const openOrders = state => {
  const all = allOrders(state)
  const filled = filledOrders(state)
  const cancelled = cancelledOrders(state)

  const openOrders = reject(all, (order) => {
    const orderFilled = filled.some((o) => o.id.toString() === order.id.toString())
    const orderCancelled = cancelled.some((o) => o.id.toString() === order.id.toString())
    return(orderFilled || orderCancelled)
  })

  return openOrders

}

export const myOpenOrdersSelector = createSelector(
    account,
    tokens,
    openOrders,
    (account, tokens, orders) => {
      if (!tokens[0] || !tokens[1]) { return }

      orders = orders.filter((o) => o.user === account)

      orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
      orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

      orders = decorateMyOpenOrders(orders, tokens)

      orders = orders.sort((a, b) => b.timestamp - a.timestamp)

      return orders

  }
)

const decorateMyOpenOrders = (orders, tokens) => {
  return(
    orders.map((order) => {
      order = decorateOrder(order, tokens)
      order = decorateMyOpenOrder(order, tokens)
      return(order)
    })
  )
}

const decorateMyOpenOrder = (order, tokens) => {
  let orderType = order.tokenGive === tokens[1].address ? 'buy' : 'sell'

  return({
    ...order,
    orderType,
    orderTypeClass: (orderType === 'buy' ? GREEN : RED)
  })
}

const decorateOrder = (order, tokens) => {
  let token0Amount, token1Amount
 
  if (order.tokenGive === tokens[1].address) {
  	token0Amount = order.amountGive
  	token1Amount = order.amountGet
  } else {
  	token0Amount = order.amountGet
  	token1Amount = order.amountGive
  }

  const precision = 100000
  let tokenPrice = (token1Amount / token0Amount)
  tokenPrice = Math.round(tokenPrice * precision) / precision

  return ({
  	...order,
  	token0Amount: ethers.utils.formatUnits(token0Amount, 'ether'),
  	token1Amount: ethers.utils.formatUnits(token1Amount, 'ether'),
  	tokenPrice,
  	formattedTimestamp: moment.unix(order.timestamp).format('h:mm:ssa d MM D')
  })
}

export const filledOrdersSelector = createSelector(
  filledOrders,
  tokens,
  (orders, tokens) => {
    if (!tokens[0] || !tokens[1]) { return }

      orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
      orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

      orders = orders.sort((a, b) => a.timestamp - b.timestamp)

      orders = decorateFilledOrders(orders, tokens)

      orders = orders.sort((a, b) => b.timestamp - a.timestamp)

      return orders

  }
)

const decorateFilledOrders = (orders, tokens) => {
  let previousOrder = orders[0]

  return(
    orders.map((order) => {
      order = decorateOrder(order, tokens)
      order = decorateFilledOrder(order, previousOrder)
      previousOrder = order
      return order
    })
  )
}

const decorateFilledOrder = (order, previousOrder) => {
  return({
    ...order,
    tokenPriceClass: tokenPriceClass(order.tokenPrice, order.id, previousOrder)
  })
}

const tokenPriceClass = (tokenPrice, orderId, previousOrder) => {
  if(previousOrder.id === orderId) {
    return GREEN
  }

  if (previousOrder.tokenPrice <= tokenPrice) {
    return GREEN
  } else {
    return RED
  }
}

export const myFilledOrdersSelector = createSelector(
    account,
    tokens,
    filledOrders,
    (account, tokens, orders) => {
      if (!tokens[0] || !tokens[1]) { return }

      orders = orders.filter((o) => o.user === account || o.creator === account)
      orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
      orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

      orders = orders.sort((a, b) => b.timestamp - a.timestamp)
      
      orders = decorateMyFilledOrders(orders, account, tokens)

      return orders
  }
)

const decorateMyFilledOrders = (orders, account, tokens) => {
  return(
    orders.map((order) => {
      order = decorateOrder(order, tokens)
      order = decorateMyFilledOrder(order, account, tokens)
      return(order)
    })
  )
}

const decorateMyFilledOrder = (order, account, tokens) => {
  const myOrder = order.creator === account

  let orderType
  if(myOrder) {
    orderType = order.tokenGive === tokens[1].address ? 'buy' : 'sell'
  } else {
    orderType = order.tokenGive === tokens[1].address ? 'sell' : 'buy'
  }

  return({
    ...order,
    orderType,
    orderClass: (orderType === 'buy' ? GREEN : RED),
    orderSign: (orderType === 'buy' ? '+' : '-')
  })
}

export const orderBookSelector = createSelector(
  openOrders,
  tokens,
  (orders, tokens) => {
    if (!tokens[0] || !tokens[1]) { return }

    orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
    orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

    orders = decorateOrderBookOrders(orders, tokens)
   
    orders = groupBy(orders, 'orderType')
    
    const buyOrders = get(orders, 'buy', [])

    orders = {
      ...orders,
      buyOrders: buyOrders.sort((a, b) => b.tokenPrice - a.tokenPrice)
    }

    const sellOrders = get(orders, 'sell', [])
    
    orders = {
      ...orders,
      sellOrders: sellOrders.sort((a, b) => b.tokenPrice - a.tokenPrice)
    }
    
    return orders
  }
)

const decorateOrderBookOrders = (orders, tokens) => {
  return(
    orders.map((order) => {
      order = decorateOrder(order, tokens)
      order = decorateOrderBookOrder(order, tokens)
      return(order)
    })
  )
}

const decorateOrderBookOrder = (order, tokens) => {
  const orderType = order.tokenGive === tokens[1].address ? 'buy' : 'sell'

  return({
    ...order,
    orderType,
    orderTypeClass: (orderType === 'buy' ? GREEN : RED),
    orderFillAction: (orderType === 'buy' ? 'sell' : 'buy')
  })
}

export const priceChartSelector = createSelector(
  filledOrders,
  tokens,
  (orders, tokens) => {
    if (!tokens[0] || !tokens[1]) { return }

    orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
    orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

    orders = orders.sort((a, b) => a.timestamp - b.timestamp)

    orders = orders.map((o) => decorateOrder(o, tokens))

    let secondLastOrder, lastOrder
    [secondLastOrder, lastOrder] = orders.slice(orders.length - 2, orders.length)

    const lastPrice = get(lastOrder, 'tokenPrice', 0)

    const secondLastPrice = get(secondLastOrder, 'tokenPrice', 0)

    return ({
      lastPrice,
      lastPriceChange: (lastPrice >= secondLastPrice ? '+' : '-'),
      series: [{
        data: buildGraphData(orders)
      }]
    })
  
  }
)

const buildGraphData = (orders) => {
    
  orders = groupBy(orders, (o) => moment.unix(o.timestamp).startOf('hour').format())

  const hours = Object.keys(orders)

  const graphData = hours.map((hour) => {
    const group = orders[hour]

    const open = group[0]
    const high = maxBy(group, 'tokenPrice')
    const low = minBy(group, 'tokenPrice')
    const close = group[group.length - 1]

    return({
      x: new Date(hour),
      y: [open.tokenPrice, high.tokenPrice, low.tokenPrice, close.tokenPrice]
    })
  })
  
  return graphData
}
