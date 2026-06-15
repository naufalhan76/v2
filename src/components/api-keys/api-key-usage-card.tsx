import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function ApiKeyUsageCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Using Your API Key</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Authentication</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Include your API key in the <code className="bg-muted px-2 py-1 rounded">x-api-key</code> header:
          </p>
          <div className="bg-muted p-3 rounded-lg overflow-x-auto">
            <code className="text-sm">{`curl -H "x-api-key: sk_live_..." https://api.example.com/api/orders`}</code>
          </div>
        </div>
        <Separator />
        <div>
          <h4 className="font-medium mb-2">Example cURL Request</h4>
          <div className="bg-muted p-3 rounded-lg overflow-x-auto">
            <code className="text-sm whitespace-pre-wrap">{`curl -X GET \
  -H \"x-api-key: sk_live_your_api_key\" \
  https://api.example.com/api/orders?page=1&limit=10`}</code>
          </div>
        </div>
        <Separator />
        <div>
          <h4 className="font-medium mb-2">Available Endpoints</h4>
          <p className="text-sm text-muted-foreground">
            All REST API endpoints accept your API key for authentication. See the API documentation page for the complete list of endpoints.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
