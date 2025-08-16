import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const PRINTNODE_API_KEY = Deno.env.get('PRINTNODE_API_KEY')
    
    if (!PRINTNODE_API_KEY) {
      throw new Error('PrintNode API key not configured')
    }

    return new Response(
      JSON.stringify({ apiKey: PRINTNODE_API_KEY }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Get PrintNode key error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to get API key' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})