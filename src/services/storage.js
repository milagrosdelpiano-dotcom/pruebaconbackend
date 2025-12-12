/**
 * Servicio de Almacenamiento de Archivos
 * =======================================
 * 
 * Este servicio maneja la subida y gestión de archivos (principalmente imágenes)
 * en Supabase Storage. Incluye funciones para:
 * - Comprimir imágenes antes de subirlas
 * - Convertir imágenes a diferentes formatos
 * - Subir avatares de usuario
 * - Subir fotos de mascotas
 * - Subir fotos de reportes
 * 
 * Todas las imágenes se comprimen antes de subir para ahorrar ancho de banda
 * y espacio de almacenamiento.
 */

import * as FileSystem from 'expo-file-system/legacy';  // API legacy de FileSystem
import * as ImageManipulator from 'expo-image-manipulator';  // Para manipular imágenes
import { supabase } from './supabase.js';  // Cliente de Supabase

/**
 * Comprime una imagen reduciendo su tamaño y calidad
 * 
 * @param {string} uri - URI de la imagen a comprimir (local file://)
 * @param {number} quality - Calidad de compresión (0.0-1.0, default: 0.7)
 * @returns {Promise<string>} URI de la imagen comprimida
 * 
 * La imagen se redimensiona a un ancho máximo de 1200px manteniendo
 * la proporción de aspecto, y se comprime con la calidad especificada.
 */
const compressImage = async (uri, quality = 0.7) => {
  try {
    // Manipular la imagen: redimensionar y comprimir
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,  // URI de la imagen original
      [{ resize: { width: 1200 } }],  // Redimensionar a máximo 1200px de ancho
      {
        compress: quality,  // Calidad de compresión (0.0 = máxima compresión, 1.0 = sin compresión)
        format: ImageManipulator.SaveFormat.JPEG,  // Formato de salida (JPEG)
      }
    );
    
    // Retornar la URI de la imagen comprimida
    return manipulatedImage.uri;
  } catch (error) {
    console.error('Error comprimiendo imagen:', error);
    throw error;
  }
};

const imageToBase64 = async (uri) => {
  try {
    // Usar la API legacy de FileSystem de manera simple
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    return base64;
  } catch (error) {
    console.error('Error convirtiendo imagen a base64:', error);
    throw error;
  }
};

const generateUniqueFileName = (prefix = 'image') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}.jpg`;
};

const uploadAvatar = async (userId, imageUri) => {
  try {
    const compressedUri = await compressImage(imageUri, 0.6);
    const base64 = await imageToBase64(compressedUri);
    const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    
    const fileName = 'avatar.jpg';
    const filePath = `${userId}/${fileName}`;
    
    await supabase.storage
      .from('avatars')
      .remove([filePath]);
    
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    
    if (error) throw error;
    
    const { data: publicData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    
    return {
      path: data.path,
      url: publicData.publicUrl,
      error: null,
    };
  } catch (error) {
    console.error('Error subiendo avatar:', error);
    return { path: null, url: null, error };
  }
};

const uploadPetPhotos = async (userId, petId, imageUris) => {
  try {
    const uploadedPhotos = [];
    
    for (let i = 0; i < imageUris.length; i++) {
      const uri = imageUris[i];
      const compressedUri = await compressImage(uri, 0.7);
      const base64 = await imageToBase64(compressedUri);
      const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      
      const fileName = `${petId}_${i + 1}.jpg`;
      const filePath = `${userId}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('pet-photos')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (error) {
        console.error(`Error subiendo foto ${i + 1}:`, error);
        continue;
      }
      
      const { data: publicData } = supabase.storage
        .from('pet-photos')
        .getPublicUrl(filePath);
      
      uploadedPhotos.push(publicData.publicUrl);
    }
    
    return {
      urls: uploadedPhotos,
      error: uploadedPhotos.length === 0 ? new Error('No se pudo subir ninguna foto') : null,
    };
  } catch (error) {
    console.error('Error subiendo fotos de mascota:', error);
    return { urls: [], error };
  }
};

const uploadReportPhotos = async (userId, reportId, imageUris) => {
  try {
    const uploadedPhotos = [];
    
    for (let i = 0; i < imageUris.length; i++) {
      const uri = imageUris[i];
      const compressedUri = await compressImage(uri, 0.7);
      const base64 = await imageToBase64(compressedUri);
      const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      
      const fileName = `${reportId}_${i + 1}.jpg`;
      const filePath = `${userId}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('report-photos')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (error) {
        console.error(`Error subiendo foto de reporte ${i + 1}:`, error);
        continue;
      }
      
      const { data: publicData } = supabase.storage
        .from('report-photos')
        .getPublicUrl(filePath);
      
      uploadedPhotos.push(publicData.publicUrl);
    }
    
    return {
      urls: uploadedPhotos,
      error: uploadedPhotos.length === 0 ? new Error('No se pudo subir ninguna foto') : null,
    };
  } catch (error) {
    console.error('Error subiendo fotos de reporte:', error);
    return { urls: [], error };
  }
};

const uploadMessageImage = async (userId, conversationId, imageUri) => {
  try {
    const compressedUri = await compressImage(imageUri, 0.7);
    const base64 = await imageToBase64(compressedUri);
    const arrayBuffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const fileName = generateUniqueFileName('message');
    const filePath = `${userId}/${conversationId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const { data: publicData } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(filePath);

    return {
      url: publicData.publicUrl,
      path: data.path,
      error: null,
    };
  } catch (error) {
    console.error('Error subiendo imagen de mensaje:', error);
    return { url: null, path: null, error };
  }
};

const storageService = {
  compressImage,
  imageToBase64,
  uploadAvatar,
  uploadPetPhotos,
  uploadReportPhotos,
  uploadMessageImage,
};

export { storageService };
