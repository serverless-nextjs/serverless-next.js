const isDynamicRoute = (route: string): boolean => {
  // Identify /[param]/ in route string
  return /\/\[[^\/]+?\](?=\/|$)/.test(route);
};

export default isDynamicRoute;
