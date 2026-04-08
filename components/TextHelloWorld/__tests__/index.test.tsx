import { render } from "@testing-library/react-native"
import TextHelloWorld from ".."

test('make sure its render properly', async () => {
    const {getByTestId} = render(<TextHelloWorld stepContainer={{flex: 1, gap: 8, marginBottom: 8}} />)
    const welcomeText = getByTestId('welcome-text')
    expect(welcomeText).toHaveTextContent('Edit app/(tabs)/index.tsx to see changes. Press cmd + d to open developer tools.')
})
