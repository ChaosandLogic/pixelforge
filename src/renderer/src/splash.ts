const params = new URLSearchParams(window.location.search)
const product = params.get('product') === 'player' ? 'player' : 'editor'

document.documentElement.dataset['product'] = product
const label = document.getElementById('product')
if (label !== null) label.textContent = product === 'player' ? 'Player' : 'Editor'
document.title = product === 'player' ? 'PixelForge Player' : 'PixelForge'
