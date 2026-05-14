import React, { useState } from 'react';
import { View, Button, Modal, StyleSheet, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';

export const FlipWebView = () => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Button
        title="Open Flip"
        onPress={() => setModalVisible(true)}
        testID="open-flip-button"
      />
      
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        testID="flip-modal"
      >
        <SafeAreaView style={styles.modalContainer}>
          <Button 
            title="Close WebView" 
            onPress={() => setModalVisible(false)} 
            testID="close-flip-button"
          />
          <WebView
            source={{ uri: 'https://flip.id/id' }}
            style={styles.webview}
            testID="flip-webview"
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
});
