import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Intentamos consultar la tabla 'clientes' para verificar si está creada
    const { data, error } = await supabase.from('clientes').select('*').limit(1);
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        message: 'Error al conectar con las tablas. ¿Ejecutaste el archivo schema.sql en el SQL Editor de Supabase?',
        error: error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '¡Conexión exitosa! Las tablas están creadas y listas para usarse.', 
      data 
    });
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      message: 'Error de servidor al intentar conectar con Supabase.',
      error: err.message 
    }, { status: 500 });
  }
}
