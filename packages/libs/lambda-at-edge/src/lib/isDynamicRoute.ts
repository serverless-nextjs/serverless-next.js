const isDynamicRoute = (route: string): boolean => {
  // Identify /[param]/ in route string
  return /\/\[[^\/]+?](?=\/|$)/.test(route);
};

const isOptionalCatchAllRoute = (route: string): boolean => {
  // Identify /[[param]]/ in route string
  return /\/\[\[[^\/]+?]](?=\/|$)/.test(route);
};

export { isDynamicRoute, isOptionalCatchAllRoute };
