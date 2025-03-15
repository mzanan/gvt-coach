import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Check for authorization
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.ADMIN_API_KEY;
    
    if (!apiKey || !authHeader || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Step 1: Find all checkout_order_id values that have multiple bookings
    const { data: duplicates, error: duplicatesError } = await supabase.rpc(
      'find_duplicate_checkout_order_ids',
      {}
    );
    
    if (duplicatesError) {
      return NextResponse.json(
        { error: 'Failed to find duplicates', details: duplicatesError },
        { status: 500 }
      );
    }
    
    if (!duplicates || duplicates.length === 0) {
      return NextResponse.json({ message: 'No duplicates found' });
    }
    
    // Step 2: For each duplicate group, keep the most recent one and update the rest
    const results = [];
    
    for (const dup of duplicates) {
      const checkoutOrderId = dup.checkout_order_id;
      
      // Get all bookings with this checkout_order_id
      const { data: bookings, error: bookingsError } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('*')
        .eq('checkout_order_id', checkoutOrderId)
        .order('created_at', { ascending: false });
      
      if (bookingsError) {
        results.push({
          checkoutOrderId,
          error: 'Failed to fetch bookings',
          details: bookingsError
        });
        continue;
      }
      
      if (!bookings || bookings.length <= 1) {
        results.push({
          checkoutOrderId,
          message: 'No duplicates found'
        });
        continue;
      }
      
      // Keep the first one (most recent) and update the rest
      const [, ...updateBookings] = bookings;
      
      // Generate new unique checkout_order_ids for the duplicates
      for (const booking of updateBookings) {
        const newCheckoutOrderId = `${checkoutOrderId}-duplicate-${booking.id}`;
        
        const { error: updateError } = await supabase
          .from('gvt_coach_meetings_bookings')
          .update({ checkout_order_id: newCheckoutOrderId })
          .eq('id', booking.id);
        
        results.push({
          checkoutOrderId,
          bookingId: booking.id,
          newCheckoutOrderId,
          success: !updateError,
          error: updateError ? updateError.message : null
        });
      }
    }
    
    return NextResponse.json({
      message: `Processed ${duplicates.length} duplicate groups`,
      results
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Make sure to create this database function in Supabase:
/*
CREATE OR REPLACE FUNCTION find_duplicate_checkout_order_ids()
RETURNS TABLE (checkout_order_id TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.checkout_order_id, 
    COUNT(*) AS count
  FROM 
    gvt_coach_meetings_bookings b
  WHERE 
    b.checkout_order_id IS NOT NULL
  GROUP BY 
    b.checkout_order_id
  HAVING 
    COUNT(*) > 1
  ORDER BY 
    COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;
*/ 