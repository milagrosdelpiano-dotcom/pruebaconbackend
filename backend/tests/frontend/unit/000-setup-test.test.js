/**
 * Prueba simple para validar configuración de Jest
 */

describe('Configuración de Jest', () => {
  test('debe ejecutar pruebas básicas', () => {
    expect(1 + 1).toBe(2);
  });

  test('debe tener acceso a funciones de Jest', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});


