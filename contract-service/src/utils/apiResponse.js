// utils/apiResponse.js

export const sendSuccess = (res, data, status = 200) => {
  res.status(status).json({ success: true, data });
}

export const sendError = (res, error, status = 500) => {
  res.status(status).json({ 
    success: false, 
    error: typeof error === 'string' ? error : error.message || 'Unknown error',
  });
}

