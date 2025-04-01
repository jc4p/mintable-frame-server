import { Elysia } from 'elysia';

const app = new Elysia();

// NFT metadata template
const generateNftMetadata = (tokenId) => {
  return {
    name: `Smoothie Cup #${tokenId}`,
    description: "A delicious smoothie cup NFT",
    image: "https://images.kasra.codes/smoothie_cup.jpeg",
    attributes: [
      {
        trait_type: "Collection",
        value: "Smoothie Cups"
      },
      {
        trait_type: "Token ID",
        value: tokenId.toString()
      }
    ]
  };
};

// Route for token metadata
app.get('/tokens/:tokenId', ({ params }) => {
  const tokenId = parseInt(params.tokenId);
  return generateNftMetadata(tokenId);
});

// Root route for API info
app.get('/', () => {
  return {
    name: "NFT Metadata API",
    description: "API for Smoothie Cup NFT metadata",
    endpoints: {
      tokens: "/tokens/{tokenId}"
    }
  };
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`NFT Metadata server is running at http://localhost:${port}`);
});