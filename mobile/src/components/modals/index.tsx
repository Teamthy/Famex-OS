import React from "react";
import { Modal as RNModal, Pressable, View, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme";
import { Card } from "@/src/components/cards";
import { H3 } from "@/src/components/typography";

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  style?: ViewStyle;
}

/** Centred modal with a backdrop tap-to-close. */
export function Modal({ visible, onClose, title, children, footer, style }: ModalProps) {
  const { spacing, colors } = useTheme();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background.overlay, padding: spacing.lg }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420 }}>
          <Card variant="elevated" padding={spacing.lg} style={style}>
            {title && <H3 style={{ marginBottom: spacing.md }}>{title}</H3>}
            {children}
            {footer && <View style={{ marginTop: spacing.lg }}>{footer}</View>}
          </Card>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
