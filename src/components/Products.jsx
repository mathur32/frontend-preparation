export const Products = ({ title, price, inStock, categories }) => {
  return (
    <> 
       <h3>{title}</h3>
       <p>Price: ${price.toFixed(2)}</p>
       <p>In Stock: {inStock ? 'Yes' : 'No'}</p>
       <p>Categories: {categories.join(', ')}</p>
    </>
        )
    }