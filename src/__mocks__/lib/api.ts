// Create a spy-like object for testing
const createMockFn = () => {
  const calls: any[] = [];
  const responses: any[] = [];
  let responseIndex = 0;

  const fn = async (wallet: string) => {
    calls.push(wallet);
    if (responseIndex < responses.length) {
      const response = responses[responseIndex++];
      if (response.type === "reject") {
        throw response.value;
      }
      return response.value;
    }
    return { has_email: false, verified: false, unsubscribed: false };
  };

  fn.mockResolvedValueOnce = (value: any) => {
    responses.push({ type: "resolve", value });
    return fn;
  };

  fn.mockRejectedValueOnce = (error: any) => {
    responses.push({ type: "reject", value: error });
    return fn;
  };

  fn.mockClear = () => {
    calls.length = 0;
    responses.length = 0;
    responseIndex = 0;
  };

  fn.mock = {
    calls: calls,
  };

  // Add toHaveBeenCalled logic
  Object.defineProperty(fn, 'toHaveBeenCalled', {
    get() {
      return calls.length > 0;
    }
  });

  // Add toHaveBeenCalledTimes logic
  fn.toHaveBeenCalledTimes = function(count: number) {
    return calls.length === count;
  };

  fn.toHaveBeenCalled = () => calls.length > 0;

  return fn;
};

export const api = {
  getNotificationStatus: createMockFn(),
};
