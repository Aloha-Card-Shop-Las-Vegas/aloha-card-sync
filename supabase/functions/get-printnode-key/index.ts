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
    // Try primary API key first
    let PRINTNODE_API_KEY = Deno.env.get('PRINTNODE_API_KEY')
    let keySource = 'primary'
    
    console.log('Primary API key check - PRINTNODE_API_KEY exists:', !!PRINTNODE_API_KEY)
    
    // If primary key not found, try backup
    if (!PRINTNODE_API_KEY) {
      console.log('Primary key not found, trying backup...')
      PRINTNODE_API_KEY = Deno.env.get('PRINTNODE_API_KEY_BACKUP')
      keySource = 'backup'
      console.log('Backup API key check - PRINTNODE_API_KEY_BACKUP exists:', !!PRINTNODE_API_KEY)
    }
    
    if (!PRINTNODE_API_KEY) {
      console.error('Neither primary nor backup PrintNode API keys found')
      throw new Error('PrintNode API key not configured - check both PRINTNODE_API_KEY and PRINTNODE_API_KEY_BACKUP secrets')
    }

    console.log(`Successfully retrieved PrintNode API key from ${keySource} source`)

    return new Response(
      JSON.stringify({ 
        apiKey: PRINTNODE_API_KEY,
        keySource: keySource,
        success: true 
      }),
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
        error: error.message || 'Failed to get API key',
        success: false
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