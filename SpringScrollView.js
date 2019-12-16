/**
 * Author: Shi(bolan0000@icloud.com)
 * Date: 2019/1/17
 * Copyright (c) 2018, AoTang, Inc.
 *
 * Description:
 */

import * as React from "react";
import {
  Animated,
  requireNativeComponent,
  View,
  findNodeHandle,
  UIManager,
  Keyboard,
  Platform,
  NativeModules,
  StyleSheet,
  ViewProps,
  ViewStyle,
  ScrollView
} from "react-native";
import * as TextInputState from "react-native/Libraries/Components/TextInput/TextInputState";
import { FooterStatus } from "./LoadingFooter";
import { NormalHeader } from "./NormalHeader";
import { NormalFooter } from "./NormalFooter";
import type { HeaderStatus } from "./RefreshHeader";
import { idx } from "./idx";
import type { Offset, SpringScrollViewPropType } from "./Types";
import { styles } from "./styles";

function detachScrollStatus() {
  let self = this;

  function hitStatus(statues, statusOld) {
    if (!statues) {
      return false;
    }
    let hassStatus = false;
    statues.some(status => {
      if (statusOld === status) {
        hassStatus = true;
        return true;
      }
    });
    return hassStatus;
  }
  function hitRefreshStatus(statues) {
    return hitStatus(statues, self._refreshStatus);
  }
  function hitLoadingStatus(statues) {
    return hitStatus(statues, self._loadingStatus);
  }
  function overshootHead() {
    return self._offsetYValue < 0;
  }
  function overshootRefresh() {
    return self._offsetYValue < -self._refreshHeaderHeight;
  }
  function overshootFooter() {
    return self._offsetYValue > self._contentHeight - self._height;
  }
  function overshootLoading(){
    return self._offsetYValue > self._contentHeight - self._height + self._loadingFooterHeight;
  }
  function shouldPulling() {
      return self._refreshHeaderHeight > 0 && hitRefreshStatus(['waiting', 'pullingCancel']) && overshootHead();
  }
  function shouldPullingEnough() {
    return self._refreshHeaderHeight > 0 && hitRefreshStatus(["pulling"]) && overshootRefresh();
  }
  function shouldPullingCancel() {
    return self._refreshHeaderHeight > 0 && hitRefreshStatus(["pullingEnough"]) && overshootHead() && !overshootRefresh();
  }
  function shouldRefresh() {
    return self._refreshHeaderHeight > 0 && hitRefreshStatus(["pullingEnough"]) && overshootRefresh();
  }
  function shouldWaiting() {
    return self._refreshHeaderHeight > 0 && hitRefreshStatus(["rebound","pullingCancel"]) && self._offsetYValue > 0;
  }

  function shouldDragging() { 
    return self._loadingFooterHeight > 0 && hitLoadingStatus(["waiting","draggingCancel"]) && overshootFooter();
  }

  function shouldDraggingEnough() {
    return self._loadingFooterHeight > 0 && hitLoadingStatus(["dragging"]) && overshootLoading();
  }
  
  function shouldLoad() {
    return self._loadingFooterHeight > 0 && hitLoadingStatus(["draggingEnough"]) && overshootLoading();
  }
  function shouldDraggingCancel(){
    return self._loadingFooterHeight > 0 &&  hitLoadingStatus(["draggingEnough"]) && overshootFooter() && !overshootLoading();
  }
  function shouldFooterWaiting() {
    return self._loadingFooterHeight > 0 && hitLoadingStatus(["rebound","draggingCancel"]) && !overshootFooter();
  }


  if (shouldPulling()) {
      self._refreshStatus = "pulling";
  } else if (shouldPullingEnough()) {
      self._refreshStatus = "pullingEnough";
  } else if (shouldPullingCancel()){
      self._refreshStatus = "pullingCancel";
  } else if (shouldWaiting()){
      self._refreshStatus = "waiting";
  }

  if (shouldDragging()) {
      self._loadingStatus = "dragging";
  } else if (shouldDraggingEnough()){
      self._loadingStatus = "draggingEnough";
  } else if (shouldDraggingCancel()) {
      self._loadingStatus = "draggingCancel";
  } else if (shouldFooterWaiting()) {
      self._loadingStatus = "waiting";
  }

  return {
    shouldLoad,
    shouldRefresh,
    hitRefreshStatus,
    hitLoadingStatus,
    loadingStatus: self._loadingStatus,
    refreshStatus: self._refreshStatus
  }

}

class SpringScrollViewComponent extends ScrollView {

}

export class SpringScrollView extends React.PureComponent<SpringScrollViewPropType> {
  _offsetY: Animated.Value;
  _offsetX: Animated.Value;
  _offsetYValue: number = 0;
  _event;
  _keyboardHeight: number;
  _refreshHeader;
  _loadingFooter;
  _width: number;
  _height: number;
  _scrollView: View;
  _indicatorOpacity: Animated.Value = new Animated.Value(1);
  _contentHeight: number;
  _contentWidth: number;
  _refreshStatus: HeaderStatus = "waiting";
  _loadingStatus: FooterStatus = "waiting";
  _indicatorAnimation;
  _nativeOffset;
  _refreshHeaderHeight: number = 0;
  _loadingFooterHeight: number = 0;
  _contentOffset: Offset = {x:0, y: 0};

  constructor(props: SpringScrollViewPropType) {
    super(props);
    this.obtainScrollEvent(props);
    if (props.initialContentOffset.x > 0 || props.initialContentOffset.y  > 0) {
      this.__needScroll = true;
      this._contentOffset = props.initialContentOffset;
    }
    this._offsetX.setValue(props.initialContentOffset.x);
    this._offsetY.setValue(props.initialContentOffset.y);

    if (props.refreshHeader) {
      this._refreshHeaderHeight = props.refreshHeader.height;
    }
    if (props.loadingFooter) {
      this._loadingFooterHeight = props.loadingFooter.height;
    }
  
  }

  UNSAFE_componentWillReceiveProps(nextProps: SpringScrollViewPropType) {
    if (nextProps.refreshHeader) {
      this._refreshHeaderHeight = nextProps.refreshHeader.height;
    } else {
      this._refreshHeaderHeight = 0;
    }
    if (nextProps.loadingFooter) {
      this._loadingFooterHeight = nextProps.loadingFooter.height;
    } else {
      this._refreshHeaderHeight = 0;
    }
    if (nextProps.allLoaded) {
      this._loadingStatus = 'allLoaded';
    } else if (nextProps.allLoaded == false) {
      this._loadingStatus = 'waiting';
    }
  }

  obtainScrollEvent(props: SpringScrollViewPropType) {
    if (!props) props = {};
    this._nativeOffset = {
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      ...props.onNativeContentOffsetExtract
    };
    this._offsetY = this._nativeOffset.y;
    this._offsetX = this._nativeOffset.x;
    this._event = Animated.event(
      [
        {
          nativeEvent: {
            contentOffset: this._nativeOffset
          }
        }
      ],
      {
        useNativeDriver: true,
        listener: this._onScroll
      }
    );
  }

  render() {
    const {
      style,
      inverted,
      children,
      onRefresh,
      onLoading,
      refreshHeader: Refresh,
      loadingFooter: Loading
    } = this.props;
    const wStyle = StyleSheet.flatten([
      styles.wrapperStyle,
      style,
      { transform: inverted ? [{ scaleY: -1 }] : [] }
    ]);
    const elements = (
      <SpringScrollViewNative
        {...this.props}
        ref={ref => (this._scrollView = ref)}
        style={Platform.OS === "android" ? wStyle : { flex: 1 }}
        onScroll={this._event}
        refreshHeaderHeight={onRefresh ? Refresh.height : 0}
        loadingFooterHeight={onLoading ? Loading.height : 0}
        onLayout={this._onWrapperLayoutChange}
        onTouchBegin={Platform.OS === "android" && this._onTouchBegin}
        onTouchStart={Platform.OS === "ios" && this._onTouchBegin}
        onScrollEndDrag={this._onScrollEndDrag}
        onMomentumScrollEnd={this._onMomentumScrollEnd}
        scrollEventThrottle={1}
        onNativeContentOffsetExtract={this._nativeOffset}
        contentContainerStyle={this.props.contentStyle}
        onContentSizeChange={this._onContentLayoutChange}
      >
        {this._renderRefreshHeader()}
        {this._renderLoadingFooter()}
        {children}
        {this._renderHorizontalIndicator()}
        {this._renderVerticalIndicator()}
      </SpringScrollViewNative>
    );
    if (Platform.OS === "android") return elements;
    return (
      <ScrollView
        style={wStyle}
        contentContainerStyle={{ flex: 1 }}
        keyboardShouldPersistTaps={this.props.keyboardShouldPersistTaps}
        keyboardDismissMode={this.props.keyboardDismissMode}
        scrollEnabled={false}
      >
        {elements}
      </ScrollView>
    );
  }

  _renderRefreshHeader() {
    const { onRefresh, refreshHeader: Refresh } = this.props;
    const measured = this._height !== undefined && this._contentHeight !== undefined;
    if (!measured) return null;
    return (
      onRefresh && (
        <Animated.View style={this._getRefreshHeaderStyle()}>
          <Refresh
            ref={ref => (this._refreshHeader = ref)}
            offset={this._offsetY}
            maxHeight={Refresh.height}
          />
        </Animated.View>
      )
    );
  }

  _renderLoadingFooter() {
    const { onLoading, loadingFooter: Footer } = this.props;
    const measured = this._height !== undefined && this._contentHeight !== undefined;
    if (!measured) return null;
    return (
      onLoading && (
        <Animated.View style={this._getLoadingFooterStyle()}>
          <Footer
            ref={ref => (this._loadingFooter = ref)}
            offset={this._offsetY}
            maxHeight={Footer.height}
            bottomOffset={this._contentHeight - this._height}
          />
        </Animated.View>
      )
    );
  }

  _renderVerticalIndicator() {
    if (Platform.OS === "ios") return null;
    const { showsVerticalScrollIndicator } = this.props;
    const measured = this._height !== undefined && this._contentHeight !== undefined;
    if (!measured) return null;
    return (
      showsVerticalScrollIndicator &&
      this._contentHeight > this._height && (
        <Animated.View style={this._getVerticalIndicatorStyle()} />
      )
    );
  }

  _renderHorizontalIndicator() {
    if (Platform.OS === "ios") return null;
    const { showsHorizontalScrollIndicator } = this.props;
    const measured = this._height !== undefined && this._contentHeight !== undefined;
    if (!measured) return null;
    return (
      showsHorizontalScrollIndicator &&
      this._contentWidth > this._width && (
        <Animated.View style={this._getHorizontalIndicatorStyle()} />
      )
    );
  }

  componentDidMount() {
    this._beginIndicatorDismissAnimation();
    this._keyboardShowSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      this._onKeyboardWillShow
    );
    this._keyboardHideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      this._onKeyboardWillHide
    );
  }

  componentDidUpdate() {
    this._beginIndicatorDismissAnimation();
  }

  componentWillUnmount() {
    this._keyboardShowSub.remove();
    this._keyboardHideSub.remove();
  }

  scrollTo(offset: Offset, animated: boolean = true) {
    this._scrollView._component.scrollTo({
      x:offset.x,
      y: offset.y,
      animated
    })
    return new Promise((resolve, reject) => {
      if (animated) setTimeout(resolve, 500);
      else resolve();
    });
  }

  scroll(offset: Offset, animated: boolean = true) {
    return this.scrollTo({ x: offset.x, y: offset.y + this._offsetYValue }, animated);
  }

  scrollToBegin(animated: boolean) {
    return this.scrollTo({ x: 0, y: 0 }, animated);
  }

  scrollToEnd(animated: boolean = true) {
    let toOffsetY = this._contentHeight - this._height;
    if (toOffsetY < 0) toOffsetY = 0;
    return this.scrollTo({ x: 0, y: toOffsetY }, animated);
  }


  endRefresh = (e) => {
    if (this._refreshStatus === "refreshing") {
      this._refreshStatus = "rebound";
      this._toRefreshStatus(this._refreshStatus);
      this.scrollTo({y: 0,x: this._contentOffset.x},true);
    }
  }

  endLoading = () => {
    if (this._loadingStatus === "loading" || this._loadingStatus == 'allLoaded' ) {
        if (this._loadingStatus == 'loading') {
          this._loadingStatus = "rebound";
        }
        this._toLoadingStatus(this._loadingStatus);
        this.scrollTo({y: this._contentOffset.y,x: this._contentOffset.x},true);
    }
  }

  _onKeyboardWillShow = evt => {
    this.props.textInputRefs.every(input => {
      if (idx(() => input.current.isFocused())) {
        input.current.measure((x, y, w, h, l, t) => {
          this._keyboardHeight = t + h - evt.endCoordinates.screenY + this.props.inputToolBarHeight;
          this._keyboardHeight > 0 && this.scroll({ x: 0, y: this._keyboardHeight });
        });
        return false;
      }
      return true;
    });
  };

  _onKeyboardWillHide = () => {
    if (this._keyboardHeight > 0) {
      this.scroll({ x: 0, y: -this._keyboardHeight });
      this._keyboardHeight = 0;
    }
  };

  _beginIndicatorDismissAnimation() {
    this._indicatorOpacity.setValue(1);
    this._indicatorAnimation && this._indicatorAnimation.stop();
    this._indicatorAnimation = Animated.timing(this._indicatorOpacity, {
      toValue: 0,
      delay: 500,
      duration: 500,
      useNativeDriver: true
    });
    this._indicatorAnimation.start(({ finished }) => {
      if (!finished) {
        this._indicatorOpacity.setValue(1);
      }
      this._indicatorAnimation = null;
    });
  }

  _detachScrollStatus(e) {
     return detachScrollStatus.call(this, e);
  }

  _onScrollEndDrag = (e) => {

    let refreshStatus = this._refreshStatus;
    let loadingStatus = this._loadingStatus;

    let { shouldRefresh, shouldLoad } = this._detachScrollStatus(e);
    if (shouldRefresh()) {
      this._refreshStatus = 'refreshing'
    }
    if (shouldLoad()) {
      this._loadingStatus = 'loading'
    }
    if (this._refreshStatus !== refreshStatus) {
      this._toRefreshStatus(this._refreshStatus);
      this.props.onRefresh && this._refreshStatus === "refreshing" && this.props.onRefresh();
    }
    if (this._loadingStatus !== loadingStatus) {
      this._toLoadingStatus(this._loadingStatus);
      this.props.onLoading && this._loadingStatus === "loading" && this.props.onLoading();
    }
    this.props.onScrollEndDrag && this.props.onScrollEndDrag(e);
  }


  _onScroll = e => {
    const {
      contentOffset
    } = e.nativeEvent;
    const { x, y } = contentOffset;
    this._contentOffset = contentOffset;
    this._offsetYValue = y;
    let refreshStatus = this._refreshStatus;
    let loadingStatus = this._loadingStatus;
    this._detachScrollStatus(e);

    if (this._refreshStatus !== refreshStatus) {
      this._toRefreshStatus(this._refreshStatus);
      this.props.onRefresh && refreshStatus === "refreshing" && this.props.onRefresh();
    }
    if (this._loadingStatus !== loadingStatus) {
      this._toLoadingStatus(this._loadingStatus);
      this.props.onLoading && loadingStatus === "loading" && this.props.onLoading();
    }

    this.props.onScroll && this.props.onScroll(e);
    if (!this._indicatorAnimation) {
      this._indicatorOpacity.setValue(1);
    }
  };

  _toRefreshStatus(status: HeaderStatus) {
    this._refreshStatus = status;
    idx(() => this._refreshHeader.changeToState(status));
  }

  _toLoadingStatus(status: FooterStatus) {
    this._loadingStatus = status;
    idx(() => this._loadingFooter.changeToState(status));
  }

  _getVerticalIndicatorStyle() {
    const indicatorHeight = this._height / this._contentHeight * this._height;
    return {
      position: "absolute",
      top: 0,
      right: 2,
      height: indicatorHeight,
      width: 3,
      borderRadius: 3,
      opacity: this._indicatorOpacity,
      backgroundColor: "#A8A8A8",
      transform: [
        {
          translateY: Animated.multiply(this._offsetY, this._height / this._contentHeight)
        }
      ]
    };
  }

  _getHorizontalIndicatorStyle() {
    const indicatorWidth = this._width / this._contentWidth * this._width;
    return {
      position: "absolute",
      bottom: 2,
      left: 0,
      height: 3,
      width: indicatorWidth,
      borderRadius: 3,
      opacity: this._indicatorOpacity,
      backgroundColor: "#A8A8A8",
      transform: [
        {
          translateX: Animated.multiply(this._offsetX, this._width / this._contentWidth)
        }
      ]
    };
  }

  _getRefreshHeaderStyle() {
    const rHeight = this.props.refreshHeader.height;
    const style = this.props.refreshHeader.style;
    let transform = [];
    if (style === "topping") {
      transform = [
        {
          translateY: this._offsetY.interpolate({
            inputRange: [-rHeight - 1, -rHeight, 0, 1],
            outputRange: [-1, 0, rHeight, rHeight]
          })
        }
      ];
    } else if (style === "stickyScrollView") {
      transform = [
        {
          translateY: this._offsetY.interpolate({
            inputRange: [-rHeight - 1, -rHeight, 0, 1],
            outputRange: [-1, 0, 0, 0]
          })
        }
      ];
    } else if (style !== "stickyContent") {
      console.warn(
        "unsupported value: '",
        style,
        "' in SpringScrollView, " +
          "select one in 'topping','stickyScrollView','stickyContent' please"
      );
    }
    if (this.props.inverted) transform.push({ scaleY: -1 });
    return {
      position: "absolute",
      top: -rHeight,
      right: 0,
      height: rHeight,
      left: 0,
      transform
    };
  }

  _getLoadingFooterStyle() {
    const fHeight = this.props.loadingFooter.height;
    const maxOffset = this._contentHeight - this._height;
    const style = this.props.loadingFooter.style;
    let transform = [];
    if (style === "bottoming") {
      transform = [
        {
          translateY: this._offsetY.interpolate({
            inputRange: [maxOffset - 1, maxOffset, maxOffset + fHeight, maxOffset + fHeight + 1],
            outputRange: [-fHeight, -fHeight, 0, 1]
          })
        }
      ];
    } else if (style === "stickyScrollView") {
      transform = [
        {
          translateY: this._offsetY.interpolate({
            inputRange: [maxOffset - 1, maxOffset, maxOffset + fHeight, maxOffset + fHeight + 1],
            outputRange: [0, 0, 0, 1]
          })
        }
      ];
    } else if (style !== "stickyContent") {
      console.warn(
        "unsupported value: '",
        style,
        "' in SpringScrollView, " +
          "select one in 'bottoming','stickyScrollView','stickyContent' please"
      );
    }
    if (this.props.inverted) transform.push({ scaleY: -1 });
    return {
      position: "absolute",
      right: 0,
      top: this._height > this._contentHeight ? this._height : this._contentHeight,
      height: fHeight,
      left: 0,
      transform
    };
  }

  _onWrapperLayoutChange = ({
    nativeEvent: {
      layout: { x, y, width, height }
    }
  }) => {
    if (this._height !== height || this._width !== width) {
      this.props.onSizeChange && this.props.onSizeChange({ width, height });
      this._height = height;
      this._width = width;
      if (!this._contentHeight) return;
      if (this._contentHeight < this._height) this._contentHeight = height;
      if (this._offsetYValue > this._contentHeight - this._height) {
        this.scrollToEnd();
      }
      this.forceUpdate();
    }
  };

  _onContentLayoutChange = (width, height) => {
    if (this._contentHeight !== height || this._contentWidth !== width) {
      this.props.onContentSizeChange && this.props.onContentSizeChange({ width, height });
      this._contentHeight = height;
      this._contentWidth = width;
      if (!this._height) return;
      if (this._contentHeight < this._height) this._contentHeight = this._height;
      if (this._offsetYValue > this._contentHeight - this._height) {
        this.scrollToEnd(false);
      }
      this.forceUpdate(); 
    }
  };

  componentDidUpdate() {
    if (this.__needScroll) {
      let {x:offsetX, y: offsetY} = this.props.initialContentOffset;
      if (this._contentHeight - this._height > offsetY || this._contentWidth - this._width > this._offsetX) {
        this.scrollTo(this.props.initialContentOffset, false);
        this.__needScroll = false;
      }
    }
  }

  _onTouchBegin = () => {
    if (TextInputState.currentlyFocusedField())
      TextInputState.blurTextInput(TextInputState.currentlyFocusedField());
    this.props.tapToHideKeyboard && Keyboard.dismiss();
    this.props.onTouchBegin && this.props.onTouchBegin();
  };

  _onMomentumScrollEnd = () => {
    this._beginIndicatorDismissAnimation();
    this.props.onMomentumScrollEnd && this.props.onMomentumScrollEnd();
  };

  static defaultProps = {
    bounces: true,
    scrollEnabled: true,
    refreshHeader: NormalHeader,
    loadingFooter: NormalFooter,
    textInputRefs: [],
    inputToolBarHeight: 44,
    tapToHideKeyboard: true,
    initOffset: { x: 0, y: 0 },
    keyboardShouldPersistTaps: "always",
    showsVerticalScrollIndicator: true,
    showsHorizontalScrollIndicator: true,
    initialContentOffset: { x: 0, y: 0 },
    alwaysBounceVertical: true
  };
}

const SpringScrollViewNative = Animated.createAnimatedComponent(SpringScrollViewComponent);