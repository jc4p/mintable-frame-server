# NFT Metadata Server

A server built with Bun and Elysia that serves ERC721 NFT metadata pointing to a static image.

## Requirements

- [Bun](https://bun.sh/) - Make sure Bun is installed on your system

## Installation

### Install Bun

If you don't have Bun installed, you can install it with:

```bash
curl -fsSL https://bun.sh/install | bash
```

### Setup Project

Clone this repository and install dependencies:

```bash
# Clone repository
git clone https://github.com/jc4p/mintable-frame-server.git
cd mintable-frame-server

# Install dependencies
bun install
```

## Running the Server

Start the server with:

```bash
bun start
```

The server will run at http://localhost:3000 by default. You can change the port by setting the `PORT` environment variable:

```bash
PORT=8080 bun start
```

## Verifying It Works

To verify the server is working correctly:

1. Start the server using the command above
2. Open a browser or use curl to access the root endpoint:
   ```bash
   curl http://localhost:3000
   ```
   You should see basic API information.

3. Test the token metadata endpoint:
   ```bash
   curl http://localhost:3000/tokens/123
   ```
   This should return JSON metadata for token #123.

## API Endpoints

- `GET /` - Shows API information
- `GET /tokens/{tokenId}` - Returns metadata for NFT with the given token ID

## Example Response

```json
{
  "name": "Smoothie Cup #123",
  "description": "A delicious smoothie cup NFT",
  "image": "https://images.kasra.codes/smoothie_cup.jpeg",
  "attributes": [
    {
      "trait_type": "Collection",
      "value": "Smoothie Cups"
    },
    {
      "trait_type": "Token ID",
      "value": "123"
    }
  ]
}
```

## License

MIT