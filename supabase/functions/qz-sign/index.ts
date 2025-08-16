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
    const { data } = await req.json()
    
    if (!data || typeof data !== 'string') {
      throw new Error('Invalid data to sign')
    }

    // In production, you would use your actual private key here
    // For now, we'll return a demo signature
    // This is where you'd implement actual RSA signing with your private key
    
    // Example of what production signing would look like:
    // const privateKey = Deno.env.get('QZ_PRIVATE_KEY')
    // const signature = await crypto.subtle.sign(
    //   'RSASSA-PKCS1-v1_5',
    //   privateKey,
    //   new TextEncoder().encode(data)
    // )
    
    // For demo purposes, return a placeholder signature
    const demoSignature = "DEMO_SIGNATURE_" + btoa(data).slice(0, 20)
    
    return new Response(
      JSON.stringify({ signature: demoSignature }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('QZ signing error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Signing failed' 
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