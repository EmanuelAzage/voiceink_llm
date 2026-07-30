export type RootStackParamList = {
  Home: undefined;
  Capture: undefined;
  Review: { cardId?: string } | undefined;
  Detail: { cardId: string };
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
